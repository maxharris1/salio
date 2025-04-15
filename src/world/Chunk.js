import * as THREE from 'three';

export class Chunk {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1; // Size of the chunk in world units
    this.resolution = options.resolution || 128; // Resolution of the chunk's geometry
    this.position = options.position || { x: 0, z: 0 }; // Position in the grid
    this.isActive = false; // Whether this chunk is currently active/visible
    this.mesh = null; // The THREE.Mesh for this chunk
    this.terrainMesh = null; // The THREE.Mesh for the terrain
    this.distanceFromCamera = options.distanceFromCamera || 0; // Distance from camera in chunk units
    this.worldManager = options.worldManager; // Reference to the world manager
  }

  /**
   * Create and return a water mesh for this chunk using the shared material
   * @param {WaterMaterial} sharedMaterial - The shared water material
   * @returns {THREE.Mesh} The created mesh
   */
  createWaterMesh(sharedMaterial) {
    // Calculate the LOD level based on distance from camera
    const lod = this.calculateLODLevel();
    
    // Create the plane geometry for this chunk with resolution adjusted for LOD
    const adjustedResolution = Math.max(16, Math.floor(this.resolution / Math.pow(2, lod)));
    
    try {
      const geometry = new THREE.PlaneGeometry(
        this.chunkSize, 
        this.chunkSize, 
        adjustedResolution, 
        adjustedResolution
      );
      
      // Create the mesh with the shared material
      this.mesh = new THREE.Mesh(geometry, sharedMaterial);
      
      // Position the mesh according to chunk coordinates
      this.mesh.position.set(
        this.position.x * this.chunkSize, 
        0, // Water level
        this.position.z * this.chunkSize
      );
      
      // Rotate to be horizontal
      this.mesh.rotation.x = Math.PI * 0.5;
      
      // Add user data to identify this mesh as belonging to this chunk
      this.mesh.userData.chunkPosition = { ...this.position };
      this.mesh.userData.lodLevel = lod;
      
      return this.mesh;
    } catch (error) {
      console.error(`Failed to create water mesh for chunk at ${this.position.x},${this.position.z} with resolution ${adjustedResolution}:`, error);
      
      // Fall back to an even lower resolution as a last resort
      const fallbackResolution = 8;
      console.warn(`Falling back to minimum resolution ${fallbackResolution}`);
      
      const geometry = new THREE.PlaneGeometry(
        this.chunkSize, 
        this.chunkSize, 
        fallbackResolution, 
        fallbackResolution
      );
      
      this.mesh = new THREE.Mesh(geometry, sharedMaterial);
      this.mesh.position.set(
        this.position.x * this.chunkSize, 
        0,
        this.position.z * this.chunkSize
      );
      this.mesh.rotation.x = Math.PI * 0.5;
      this.mesh.userData.chunkPosition = { ...this.position };
      this.mesh.userData.lodLevel = 'fallback';
      
      return this.mesh;
    }
  }

  /**
   * Calculate the appropriate LOD level based on distance from camera
   * @returns {number} The LOD level (0 = highest detail)
   */
  calculateLODLevel() {
    // LOD levels:
    // Level 0: Full resolution for chunks within 5 units of camera
    // Level 1: Half resolution for chunks within 10 units
    // Level 2: Quarter resolution for chunks within 15 units
    // Level 3: Eighth resolution for chunks beyond 15 units
    
    if (this.distanceFromCamera <= 5) return 0;
    if (this.distanceFromCamera <= 10) return 1;
    if (this.distanceFromCamera <= 15) return 2;
    return 3;
  }

  /**
   * Create and return a terrain mesh for this chunk
   * This is a placeholder for future terrain implementation
   */
  createTerrainMesh(groundMaterial) {
    // This will be expanded in the future to include terrain and island generation
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      Math.max(4, Math.floor(this.resolution / 16)), // Lower resolution for ground
      Math.max(4, Math.floor(this.resolution / 16))
    );
    
    // For now, just a simple plane below the water
    const terrainMesh = new THREE.Mesh(geometry, groundMaterial);
    terrainMesh.position.set(
      this.position.x * this.chunkSize,
      this.worldManager.oceanFloorDepth, // Use depth from WorldManager
      this.position.z * this.chunkSize
    );
    terrainMesh.rotation.x = -Math.PI * 0.5;
    
    return terrainMesh;
  }

  /**
   * Clean up resources when this chunk is no longer needed
   */
  dispose() {
    if (this.mesh) {
      // Dispose of geometry but not the shared material
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }
} 