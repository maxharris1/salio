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
    this.oceanFloorDepth = -3; // Set default ocean floor depth to -3
    
    // Calculate safe view distance based on resolution to prevent memory issues
    this.maxSafeViewDistance = this.calculateSafeViewDistance(this.resolution);
    if (this.viewDistance > this.maxSafeViewDistance) {
      console.warn(`Requested view distance ${this.viewDistance} exceeds safe limit of ${this.maxSafeViewDistance} for resolution ${this.resolution}. Limiting view distance.`);
      this.viewDistance = this.maxSafeViewDistance;
    }
    
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
    
    // Create a distant water plane to fill the gap between chunks and the horizon
    this.createDistantWaterPlane();
    
    // Map to store active chunks, keyed by 'x,z' string
    this.activeChunks = new Map();
    
    // Last known camera position for optimization
    this.lastCameraChunkPosition = { x: Infinity, z: Infinity };
    
    // Update sky radius based on world settings
    if (this.sky && this.sky.updateSkyRadius) {
      this.sky.updateSkyRadius(this.viewDistance, this.chunkSize);
    }
  }

  /**
   * Create a large, low-detail water plane that extends to the horizon
   * This helps create a seamless transition between chunked water and the sky
   */
  createDistantWaterPlane() {
    // Create a much larger plane with very low resolution
    // EXTREME size to guarantee horizon coverage
    const farPlaneSize = this.chunkSize * this.viewDistance * 100; // 10X larger
    const geometry = new THREE.PlaneGeometry(farPlaneSize, farPlaneSize, 8, 8);
    
    // Create a simplified water material for the distant plane
    // This shares some properties with the main water material but is simpler
    const distantWaterMaterial = new THREE.MeshBasicMaterial({
      color: 0x3388aa,
      transparent: false, // Fully opaque now
      opacity: 1.0,
      fog: true // Important: this plane should be affected by fog
    });
    
    this.distantWaterPlane = new THREE.Mesh(geometry, distantWaterMaterial);
    this.distantWaterPlane.rotation.x = Math.PI * 0.5;
    this.distantWaterPlane.position.y = -0.02; // Closer to surface for more visibility
    
    // Add to scene at the beginning of the scene graph so it renders behind other water
    this.scene.add(this.distantWaterPlane);
    
    // Add a debug message to confirm creation
    console.log("Created EXTREME distant water plane: ", this.distantWaterPlane);
  }

  /**
   * Update the distant water plane color based on time of day or other factors
   */
  updateDistantWater(cameraPosition) {
    if (this.distantWaterPlane) {
      // Keep the distant water plane centered on the camera
      this.distantWaterPlane.position.x = cameraPosition.x;
      this.distantWaterPlane.position.z = cameraPosition.z;
      
      // Dynamically update color based on scene fog color for better blending
      if (this.scene.fog) {
        // Extreme color adjustment to make it very obvious
        this.distantWaterPlane.material.color.copy(this.scene.fog.color);
        // Exaggerate color shifts
        this.distantWaterPlane.material.color.r *= 0.7;  // More extreme
        this.distantWaterPlane.material.color.g *= 1.2;  // More extreme
        this.distantWaterPlane.material.color.b *= 1.3;  // More extreme
      }
      
      // For debugging purposes
      if (!this.waterUpdateCount) this.waterUpdateCount = 0;
      this.waterUpdateCount++;
      
      // Log position every 100 frames to verify updates are happening
      if (this.waterUpdateCount % 100 === 0) {
        console.log("EXTREME Distant water plane position: ", 
          this.distantWaterPlane.position.x.toFixed(2), 
          this.distantWaterPlane.position.y.toFixed(2), 
          this.distantWaterPlane.position.z.toFixed(2));
      }
    } else {
      // If distant water plane is missing, create it
      console.warn("Distant water plane missing, recreating");
      this.createDistantWaterPlane();
    }
  }

  /**
   * Calculate a safe view distance based on the resolution to prevent memory issues
   */
  calculateSafeViewDistance(resolution) {
    // Each chunk uses approximately (resolution+1)² × 4 bytes × 3 (position) + other data
    // Higher resolution = fewer chunks we can safely render
    if (resolution > 256) return 8;
    if (resolution > 128) return 12;
    if (resolution > 64) return 16;
    return 20; // For low resolutions, the full 20 is fine
  }

  /**
   * Update the world based on camera position
   * @param {number} time - Current animation time
   * @param {THREE.Vector3} cameraPosition - Current camera position
   */
  update(time, cameraPosition) {
    // Update the shared water material first
    this.waterMaterial.update(time);
    
    // Update distant water plane
    this.updateDistantWater(cameraPosition);
    
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
        // Calculate the distance from the center in chunk units
        const distSq = (x - centerChunkX) * (x - centerChunkX) + 
                        (z - centerChunkZ) * (z - centerChunkZ);
        
        // Only create chunks within the view distance radius (circular rather than square area)
        // This ensures we don't render chunks outside the skybox
        if (distSq <= this.viewDistance * this.viewDistance) {
          const chunkId = `${x},${z}`;
          newActiveChunkIds.add(chunkId);
          
          // If this chunk is not already active, create and add it
          if (!this.activeChunks.has(chunkId)) {
            this.createChunk(x, z);
          }
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
    // Calculate distance from camera in chunk units
    const cameraChunkX = this.lastCameraChunkPosition.x;
    const cameraChunkZ = this.lastCameraChunkPosition.z;
    const distanceFromCamera = Math.sqrt(
      Math.pow(x - cameraChunkX, 2) + 
      Math.pow(z - cameraChunkZ, 2)
    );
    
    // Create a new chunk instance
    const chunk = new Chunk({
      chunkSize: this.chunkSize,
      resolution: this.resolution,
      position: { x, z },
      distanceFromCamera,
      worldManager: this // Pass worldManager reference to chunk
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
    // Remove the distant water plane
    if (this.distantWaterPlane) {
      this.scene.remove(this.distantWaterPlane);
      this.distantWaterPlane.geometry.dispose();
      this.distantWaterPlane.material.dispose();
    }
    
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

  /**
   * Set the view distance and ensure it doesn't exceed safe limits
   * @param {number} viewDistance - New view distance in chunks
   */
  setViewDistance(viewDistance) {
    // Ensure view distance is within safe limits
    if (viewDistance > this.maxSafeViewDistance) {
      console.warn(`Requested view distance ${viewDistance} exceeds safe limit of ${this.maxSafeViewDistance} for resolution ${this.resolution}. Limiting view distance.`);
      this.viewDistance = this.maxSafeViewDistance;
    } else {
      this.viewDistance = viewDistance;
    }
    
    // Force update of chunks
    this.lastCameraChunkPosition.x = Infinity;
    
    // Update sky radius to match
    if (this.sky && this.sky.updateSkyRadius) {
      this.sky.updateSkyRadius(this.viewDistance, this.chunkSize);
    }
  }

  /**
   * Set the ocean floor depth and update existing terrain chunks
   * @param {number} depth - The new Y position for the ocean floor
   */
  setOceanFloorDepth(depth) {
    // Clamp the depth to the allowed range (0 to -20)
    this.oceanFloorDepth = Math.max(-20, Math.min(0, depth));
    
    // Update all active terrain chunks
    for (const chunk of this.activeChunks.values()) {
      if (chunk.terrainMesh) {
        chunk.terrainMesh.position.y = this.oceanFloorDepth;
      }
    }
    
    console.log(`Ocean floor depth set to: ${this.oceanFloorDepth}`);
  }
} 