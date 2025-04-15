import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Sky } from './objects/Sky';
import { WorldManager } from './world/WorldManager';
import { setupUI } from './ui';
import { Stats } from './utils/Stats';

// Animation
const clock = new THREE.Clock();

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Load pool texture
const poolTexture = new THREE.TextureLoader().load('/ocean_floor.png');

// Camera position
camera.position.set(0.8, 0.03, 0);

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
  chunkSize: 16, // Size of each chunk in world units (doubled from 8 to 16)
  viewDistance: 3, // Default view distance - can be increased in UI up to 20
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

// Scale down wave frequency to match the larger world scale
worldManager.getWaterMaterial().uniforms.uWavesFrequency.value /= 15;
// Scale up wave amplitude for more dramatic waves
worldManager.getWaterMaterial().uniforms.uWavesAmplitude.value *= 5;

// Create performance stats display
const stats = new Stats();

// Exclude all water chunks from environment map reflections
// (will be handled by WorldManager)
sky.excludeFromReflection(worldManager);

function animate() {
  const elapsedTime = clock.getElapsedTime();

  // Update the sky with current time of day
  sky.sky.material.uniforms.uDayTime.value = timeOfDay.value;
  sky.update(elapsedTime);
  
  // Update the environment map when time of day changes
  const updatedEnvMap = sky.updateEnvironmentMap(renderer, timeOfDay.value);
  
  // Update the water's environment map in the world manager
  worldManager.updateEnvironmentMap(updatedEnvMap);
  
  // Update world manager with current camera position
  worldManager.update(elapsedTime, camera.position);
  
  controls.update();
  renderer.render(scene, camera);
  
  // Update stats display
  stats.update(elapsedTime, worldManager);
  
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
  worldConfig
});

animate();
