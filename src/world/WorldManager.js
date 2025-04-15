import * as THREE from 'three';
import { Chunk } from './Chunk';
import { WaterMaterial } from '../materials/WaterMaterial';

export class WorldManager {
  constructor(options = {}) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.sky = options.sky;
    
    // World configuration
    this.chunkSize = options.chunkSize || 2; // Size of each chunk in world units
    this.viewDistance = options.viewDistance || 5; // How many chunks to load in each direction
    this.resolution = options.resolution || 128; // Vertices per chunk edge
    
    // Initialize shared water material
    this.waterMaterial = new WaterMaterial({
      environmentMap: this.sky.environmentMap
    });
    
    // Prepare a simple ground material as placeholder
    this.groundMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x225566,
      side: THREE.FrontSide
    });
    
    // If a texture is provided, use it for the ground
    if (options.groundTexture) {
      this.groundMaterial = new THREE.MeshBasicMaterial({
        map: options.groundTexture,
        side: THREE.FrontSide
      });
    }
    
    // Map to store active chunks, keyed by 'x,z' string
    this.activeChunks = new Map();
    
    // Last known camera position for optimization
    this.lastCameraChunkPosition = { x: Infinity, z: Infinity };
  }

  /**
   * Update the world based on camera position
   * @param {number} time - Current animation time
   * @param {THREE.Vector3} cameraPosition - Current camera position
   */
  update(time, cameraPosition) {
    // Update the shared water material first
    this.waterMaterial.update(time);
    
    // Convert camera position to chunk coordinates
    const cameraChunkX = Math.floor(cameraPosition.x / this.chunkSize);
    const cameraChunkZ = Math.floor(cameraPosition.z / this.chunkSize);
    
    // Only update chunks if the camera has moved to a different chunk
    if (cameraChunkX !== this.lastCameraChunkPosition.x || 
        cameraChunkZ !== this.lastCameraChunkPosition.z) {
      
      // Remember current camera chunk position
      this.lastCameraChunkPosition.x = cameraChunkX;
      this.lastCameraChunkPosition.z = cameraChunkZ;
      
      // Update which chunks should be active
      this.updateActiveChunks(cameraChunkX, cameraChunkZ);
    }
  }

  /**
   * Update which chunks are active based on camera position
   * @param {number} centerChunkX - X coordinate of the chunk the camera is in
   * @param {number} centerChunkZ - Z coordinate of the chunk the camera is in
   */
  updateActiveChunks(centerChunkX, centerChunkZ) {
    // Determine which chunks should be active
    const newActiveChunkIds = new Set();
    
    // Calculate the range of chunks to load
    for (let x = centerChunkX - this.viewDistance; x <= centerChunkX + this.viewDistance; x++) {
      for (let z = centerChunkZ - this.viewDistance; z <= centerChunkZ + this.viewDistance; z++) {
        const chunkId = `${x},${z}`;
        newActiveChunkIds.add(chunkId);
        
        // If this chunk is not already active, create and add it
        if (!this.activeChunks.has(chunkId)) {
          this.createChunk(x, z);
        }
      }
    }
    
    // Remove chunks that are now out of range
    for (const [chunkId, chunk] of this.activeChunks.entries()) {
      if (!newActiveChunkIds.has(chunkId)) {
        // Remove this chunk's meshes from the scene
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
        }
        if (chunk.terrainMesh) {
          this.scene.remove(chunk.terrainMesh);
        }
        
        // Dispose of chunk resources
        chunk.dispose();
        
        // Remove from active chunks
        this.activeChunks.delete(chunkId);
      }
    }
  }

  /**
   * Create a new chunk at the specified coordinates
   * @param {number} x - X coordinate of the chunk in the grid
   * @param {number} z - Z coordinate of the chunk in the grid
   */
  createChunk(x, z) {
    // Create a new chunk instance
    const chunk = new Chunk({
      chunkSize: this.chunkSize,
      resolution: this.resolution,
      position: { x, z }
    });
    
    // Create water mesh for this chunk
    const waterMesh = chunk.createWaterMesh(this.waterMaterial);
    this.scene.add(waterMesh);
    
    // Create terrain mesh for this chunk
    const terrainMesh = chunk.createTerrainMesh(this.groundMaterial);
    this.scene.add(terrainMesh);
    chunk.terrainMesh = terrainMesh;
    
    // Mark chunk as active
    chunk.isActive = true;
    
    // Add to active chunks map
    this.activeChunks.set(`${x},${z}`, chunk);
    
    return chunk;
  }

  /**
   * Update the environment map for all chunks
   * @param {THREE.CubeTexture} environmentMap - The new environment map
   */
  updateEnvironmentMap(environmentMap) {
    this.waterMaterial.updateEnvironmentMap(environmentMap);
  }

  /**
   * Get the shared water material for UI control
   * @returns {WaterMaterial} The shared water material
   */
  getWaterMaterial() {
    return this.waterMaterial;
  }

  /**
   * Set the ground texture
   * @param {THREE.Texture} texture - The texture to use for the ground
   */
  setGroundTexture(texture) {
    // Update ground material with new texture
    this.groundMaterial.map = texture;
    this.groundMaterial.needsUpdate = true;
  }

  /**
   * Dispose of all resources when no longer needed
   */
  dispose() {
    // Clean up all chunks
    for (const chunk of this.activeChunks.values()) {
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
      }
      if (chunk.terrainMesh) {
        this.scene.remove(chunk.terrainMesh);
      }
      chunk.dispose();
    }
    
    // Clear the active chunks map
    this.activeChunks.clear();
    
    // Dispose of shared materials
    this.waterMaterial.dispose();
    this.groundMaterial.dispose();
  }
} 