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

// Create wave height calculator using the water material
const waveUtils = new WaveUtils(worldManager.getWaterMaterial());

// Create a boat with physics
let boat = null;
function createBoat() {
  // Create the boat in the physics world
  boat = new Boat({
    scene,
    world: physicsWorld,
    getWaveHeight: (x, z) => waveUtils.getWaveHeight(x, z)
  });
  
  // Position the boat at origin for camera to see it
  boat.setPosition(0, 2, 0);
  
  // Move camera to look at the boat from behind
  camera.position.set(0, 3, -10);
  camera.lookAt(0, 1, 0);
  
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

  // Step the physics world forward
  physicsWorld.step(1/60, deltaTime, 3);
  
  // Update the boat
  if (boat) {
    boat.update();
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
  boat // Pass the boat to UI for controls
});

// Initialize fog with normal settings
if (scene.fog) {
  scene.fog.density = 0.01; // Set to normal fog density
  console.log("Initialized with normal fog density: 0.01");
}

animate();
