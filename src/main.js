import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Sky } from './objects/Sky';
import { WorldManager } from './world/WorldManager';
import { Boat } from './objects/Boat';
import { WaveUtils } from './utils/WaveUtils';
import { setupUI } from './ui';
import { Stats } from './utils/Stats';

// Feature flags for infinite ocean implementation
let ENABLE_DISTANT_WATER = false; // Will enable the distant water plane
let ENABLE_LINEAR_FOG = false;    // Will switch from exponential to linear fog
let ENABLE_DYNAMIC_FOG = false;   // Will enable camera-height based fog adjustment

// Animation
const clock = new THREE.Clock();

// Track last log time to avoid spamming console
let lastLogTime = -1;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Add fog to blend the horizon
const fogColor = new THREE.Color(0x8ED6FF); // Light blue matching sky
scene.fog = new THREE.FogExp2(fogColor, 0.1); // 10X more dense fog

// Save reference to the original exponential fog
scene.userData.expFog = scene.fog;

// Load pool texture
const poolTexture = new THREE.TextureLoader().load('/ocean_floor.png');

// Camera position
camera.position.set(0, 3, -10); // Positioned behind and above the boat, looking forward
camera.lookAt(0, 0, 0); // Looking at the center where the boat will be positioned

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Create sky
const sky = new Sky({ scene });

// Time of day parameter
const timeOfDay = { value: 0.5 }; // noon by default

// Initialize the environment map by updating it once
sky.updateEnvironmentMap(renderer, timeOfDay.value);

// Set up world manager with chunking
const worldConfig = {
  chunkSize: 16, // Size of each chunk in world units
  viewDistance: 12, // More conservative default view distance
  resolution: 256 // Vertices per chunk edge
};

const worldManager = new WorldManager({
  scene,
  camera,
  sky,
  chunkSize: worldConfig.chunkSize,
  viewDistance: worldConfig.viewDistance,
  resolution: worldConfig.resolution,
  groundTexture: poolTexture
});

// Initialize physics world for the boat
const physicsWorld = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});

// Set solver iterations for more accurate physics
physicsWorld.solver.iterations = 10;
physicsWorld.solver.tolerance = 0.001;

// Configure physics timestep - use fixed timestep for stability
physicsWorld.fixedTimeStep = 1.0 / 60.0; // 60 Hz
physicsWorld.allowSleep = false; // Don't allow bodies to sleep

// Create ground plane
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({
  mass: 0, // Static body
  shape: groundShape,
  material: new CANNON.Material('groundMaterial')
});

// Rotate the plane to be horizontal (facing up)
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

// Set ground position to ocean floor depth
// Default to -3 if worldManager.oceanFloorDepth is not available
const oceanFloorDepth = (worldManager && typeof worldManager.oceanFloorDepth === 'number') 
  ? worldManager.oceanFloorDepth 
  : -3;
groundBody.position.set(0, oceanFloorDepth, 0);

// Add ground to physics world
physicsWorld.addBody(groundBody);

// Log ground plane creation
console.log('Ground plane created at y =', oceanFloorDepth);

// Create contact material for boat-ground interaction
const boatGroundContactMaterial = new CANNON.ContactMaterial(
  new CANNON.Material('boatMaterial'),
  groundBody.material,
  {
    friction: 0.3,
    restitution: 0.3 // Slightly bouncy
  }
);
physicsWorld.addContactMaterial(boatGroundContactMaterial);

// Log physics world setup
console.log('Physics world initialized with:', {
  gravity: physicsWorld.gravity,
  iterations: physicsWorld.solver.iterations,
  groundY: groundBody.position.y
});

// --- Add World PreStep Listener for Buoyancy ---
physicsWorld.addEventListener('preStep', () => {
  if (!boat || !boat.body) return; // Exit if boat doesn't exist
  
  // Get necessary properties from the boat instance
  const body = boat.body;
  const position = body.position;
  const hullHeight = boat.hullHeight; // Assuming hullHeight is accessible
  const mass = boat.mass;
  const waterDensity = boat.waterDensity;
  const gravityMagnitude = Math.abs(physicsWorld.gravity.y);
  
  // Get water height at boat position using waveUtils
  const waterHeight = waveUtils.getWaveHeight(position.x, position.z);
  
  // Calculate boat bottom
  const bottomY = position.y - hullHeight / 2;
  
  // Check if boat bottom is below water
  if (bottomY <= waterHeight) {
    const submergedRatio = Math.min(1, (waterHeight - bottomY) / hullHeight);
    const floatForceMagnitude = mass * gravityMagnitude * 1.5 * submergedRatio;
    const floatForce = new CANNON.Vec3(0, floatForceMagnitude, 0);
    body.applyForce(floatForce, new CANNON.Vec3()); // Apply at center

    // Apply damping
    const dampingFactor = 0.1 * submergedRatio;
    const dampingForce = new CANNON.Vec3(
      -body.velocity.x * dampingFactor,
      0, 
      -body.velocity.z * dampingFactor
    );
    body.applyForce(dampingForce, new CANNON.Vec3());
    
    // Apply stabilizing torque
    const currentTilt = new CANNON.Vec3(body.quaternion.x, 0, body.quaternion.z);
    const stabilizingTorque = currentTilt.scale(-5000 * submergedRatio);
    body.applyTorque(stabilizingTorque);

    // Apply Rudder Force based on current angle and speed
    boat.applyRudderForce();

    // Apply Thrust Force based on UI slider
    const thrustMagnitude = boat.currentThrust || 0;
    if (thrustMagnitude > 0) {
      const localForward = new CANNON.Vec3(0, 0, 1); // Boat's local forward Z-axis
      const worldForward = body.quaternion.vmult(localForward);
      const thrustForce = worldForward.scale(thrustMagnitude);
      body.applyForce(thrustForce, new CANNON.Vec3()); // Apply at center of mass
    }

    // Occasional logging
    if (Math.random() < 0.01) {
      console.log('World preStep Buoyancy active:', { 
        boatY: position.y.toFixed(2),
        waterHeight: waterHeight.toFixed(2),
        submergedRatio: submergedRatio.toFixed(2),
        floatForce: floatForceMagnitude.toFixed(2)
      });
    }
  }
});
console.log("Added buoyancy logic to world preStep event.");
// --- End World PreStep Listener ---

// Create wave height calculator using the water material
const waveUtils = new WaveUtils(worldManager.getWaterMaterial());

// Debug helper for water level visualization
let waterLevelMarker = null;
let buoyancyIndicator = null;

function createDebugHelpers() {
  // Create water height marker (red sphere)
  const markerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  waterLevelMarker = new THREE.Mesh(markerGeometry, markerMaterial);
  scene.add(waterLevelMarker);
  
  // Create buoyancy indicator (shows when boat is in water)
  const indicatorGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const indicatorMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.7
  });
  buoyancyIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
  buoyancyIndicator.visible = false; // Hide initially
  scene.add(buoyancyIndicator);
  
  console.log("Created debug visualization helpers");
}

// Create the debug helpers
createDebugHelpers();

// Create a boat with physics
let boat = null;
function createBoat() {
  // Create the boat in the physics world
  boat = new Boat({
    scene,
    world: physicsWorld,
    getWaveHeight: (x, z) => waveUtils.getWaveHeight(x, z)
  });
  
  // Get the water height at the starting position
  const startX = 0;
  const startZ = 0;
  const waterHeight = waveUtils.getWaveHeight(startX, startZ);
  
  // Position the boat well above the water surface so we can observe the physics
  const startHeight = waterHeight + 8.0; // Start higher (8 units above water)
  boat.setPosition(startX, startHeight, startZ);
  
  // Log boat creation and starting position
  console.log('Boat created and positioned:', {
    position: { x: startX, y: startHeight, z: startZ },
    waterHeight: waterHeight,
    heightAboveWater: startHeight - waterHeight
  });
  
  // Move camera to look at the boat from a better angle
  camera.position.set(-5, 6, -10);
  camera.lookAt(0, 2, 0);
  
  // Return a reference to the boat for UI controls
  return boat;
}

// Create the boat
boat = createBoat();

// Create performance stats display
const stats = new Stats();

// Set initial fog density in the stats visualization
if (scene.fog && scene.fog.isFogExp2) {
  stats.setInitialFogDensity(scene.fog.density);
}

// Optional: Visualize camera frustum for debugging
let frustumHelper = null; // Will hold the camera helper if enabled

// Add event listeners for fog debugging tools
document.addEventListener('toggle-fog-type', () => {
  ENABLE_LINEAR_FOG = !ENABLE_LINEAR_FOG;
  
  if (ENABLE_LINEAR_FOG && !scene.userData.linearFog) {
    // Create linear fog if it doesn't exist yet
    scene.userData.linearFog = new THREE.Fog(
      scene.fog.color.clone(),
      camera.position.y * 10,  // Near value based on camera height
      camera.position.y * 50 + worldConfig.viewDistance * worldConfig.chunkSize // Far value
    );
  }
  
  // Switch fog types
  scene.fog = ENABLE_LINEAR_FOG ? scene.userData.linearFog : scene.userData.expFog;
  
  console.log(`Switched to ${ENABLE_LINEAR_FOG ? 'linear' : 'exponential'} fog`);
});

document.addEventListener('update-fog-density', (e) => {
  const { density } = e.detail;
  
  if (scene.fog.isFogExp2) {
    scene.fog.density = density;
  } else if (scene.userData.expFog) {
    scene.userData.expFog.density = density;
  }
  
  console.log(`Updated fog density to ${density}`);
});

// Add key listener for camera frustum visualization
document.addEventListener('keydown', (e) => {
  if (e.key === 'F2') { // F2 key toggles frustum visualization
    if (frustumHelper) {
      scene.remove(frustumHelper);
      frustumHelper.dispose();
      frustumHelper = null;
    } else {
      frustumHelper = stats.visualizeFrustum(camera, scene);
    }
  }
});

// Exclude all water chunks from environment map reflections
// (will be handled by WorldManager)
sky.excludeFromReflection(worldManager);

// Function to update fog based on time of day
function updateFogSystem(dayTime) {
  // Update fog color to match sky horizon color for seamless blending - EXTREME VERSION
  if (dayTime < 0.25) { // Night to sunrise
    const t = dayTime / 0.25;
    // EXTREME orange/pink at sunrise horizon
    scene.fog.color.setRGB(
      Math.min(1.0, t * 2.0 + 0.3), // Intense red
      t * 0.6, 
      t * 0.3
    );
  } 
  else if (dayTime < 0.5) { // Sunrise to noon
    const t = (dayTime - 0.25) / 0.25;
    // EXTREME transition from orange/pink to blue
    scene.fog.color.setRGB(
      1.3 - t * 1.0, // Very dramatic red reduction
      0.6 + t * 0.4, // Increase green
      0.3 + t * 0.7  // Increase blue
    );
  }
  else if (dayTime < 0.75) { // Noon to sunset
    const t = (dayTime - 0.5) / 0.25;
    // EXTREME transition from blue to orange/pink
    scene.fog.color.setRGB(
      0.3 + t * 1.0, // Dramatic red increase
      1.0 - t * 0.4, // Decrease green
      1.0 - t * 0.7  // Decrease blue
    );
  }
  else { // Sunset to night
    const t = (dayTime - 0.75) / 0.25;
    // EXTREME sunset to night
    scene.fog.color.setRGB(
      1.3 - t * 1.2, // Dramatic red reduction
      0.6 - t * 0.6, // Reduce green
      0.3          // Maintain some blue
    );
  }
}

function animate() {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = clock.getDelta(); // For physics calculations

  // Step the physics world forward with fixed timestep
  physicsWorld.step(physicsWorld.fixedTimeStep);
  
  // Update the boat
  if (boat) {
    boat.update();
    
    // Get boat position and water height for visualization
    const boatPos = boat.body.position;
    const waterHeight = waveUtils.getWaveHeight(boatPos.x, boatPos.z);
    
    // Check if the boat is in water (bottom of boat below water level)
    const boatBottomY = boatPos.y - boat.hullHeight / 2;
    const isInWater = boatBottomY <= waterHeight;
    
    // Update water level marker and buoyancy indicator
    if (waterLevelMarker) {
      // Position marker at water surface below boat
      waterLevelMarker.position.set(boatPos.x, waterHeight, boatPos.z);
      
      // Make marker red when boat is not in water, green when in water
      if (waterLevelMarker.material) {
        waterLevelMarker.material.color.set(isInWater ? 0x00ff00 : 0xff0000);
      }
    }
    
    if (buoyancyIndicator) {
      // Only show indicator when boat is in water
      buoyancyIndicator.visible = isInWater;
      
      if (isInWater) {
        // Position at intersection of boat and water
        const indicatorY = Math.min(boatPos.y, waterHeight);
        buoyancyIndicator.position.set(boatPos.x, indicatorY, boatPos.z);
        
        // Size indicator based on submersion
        const submergence = Math.min(1, (waterHeight - boatBottomY) / boat.hullHeight);
        const scaleSize = 0.5 + submergence;
        buoyancyIndicator.scale.set(scaleSize, scaleSize, scaleSize);
      }
    }
    
    // Periodic logging of physics state
    if (Math.floor(elapsedTime) % 3 === 0 && Math.floor(elapsedTime) !== lastLogTime) {
      lastLogTime = Math.floor(elapsedTime);
      
      // === START DEBUG LOGGING ===
      // Check if the boat body still has the preStep listener attached
      const hasListener = boat.body ? boat.body.hasEventListener('preStep') : 'N/A';
      // === END DEBUG LOGGING ===
            
      console.log(`Physics state at t=${elapsedTime.toFixed(1)}:`, {
        boatY: boatPos.y.toFixed(2),
        waterY: waterHeight.toFixed(2),
        velocity: {
          y: boat.body.velocity.y.toFixed(2),
          mag: boat.body.velocity.length().toFixed(2)
        },
        inWater: isInWater,
        submergence: isInWater ? ((waterHeight - boatBottomY) / boat.hullHeight).toFixed(2) : 0,
        // === START DEBUG LOGGING ===
        preStepListenerActive: hasListener 
        // === END DEBUG LOGGING ===
      });
    }
  }

  // Update the sky with current time of day
  sky.sky.material.uniforms.uDayTime.value = timeOfDay.value;
  sky.update(elapsedTime);
  
  // Update fog color using the extracted function
  updateFogSystem(timeOfDay.value);
  
  // Dynamic fog adjustment based on camera height if enabled
  if (ENABLE_DYNAMIC_FOG && scene.userData.linearFog) {
    scene.userData.linearFog.near = camera.position.y * 10;
    scene.userData.linearFog.far = camera.position.y * 50 + worldConfig.viewDistance * worldConfig.chunkSize;
  }
  
  // Update the environment map when time of day changes
  const updatedEnvMap = sky.updateEnvironmentMap(renderer, timeOfDay.value);
  
  // Update the water's environment map in the world manager
  worldManager.updateEnvironmentMap(updatedEnvMap);
  
  // Update world manager with current camera position
  worldManager.update(elapsedTime, camera.position);
  
  controls.update();
  renderer.render(scene, camera);
  
  // Update stats display with all required parameters
  stats.update(elapsedTime, worldManager, scene, camera);
  
  // Update frustum helper if enabled
  if (frustumHelper) {
    frustumHelper.update();
  }
  
  requestAnimationFrame(animate);
}

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Setup UI with the world manager instead of individual components
setupUI({
  waterMaterial: worldManager.getWaterMaterial(),
  worldManager,
  sky,
  timeOfDay,
  worldConfig,
  boat, // Pass the boat to UI for controls
  waveUtils // Pass waveUtils for water height calculations
});

// Initialize fog with normal settings
if (scene.fog) {
  scene.fog.density = 0.01; // Set to normal fog density
  console.log("Initialized with normal fog density: 0.01");
}

// Function to test water height at a specific position
function testWaterHeight(x, z) {
  const height = waveUtils.getWaveHeight(x, z);
  console.log(`Water height at (${x}, ${z}): ${height}`);
  return height;
}

// Test water height at origin
testWaterHeight(0, 0);

animate();
