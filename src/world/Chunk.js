import * as THREE from 'three';

export class Chunk {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1; // Size of the chunk in world units
    this.resolution = options.resolution || 128; // Resolution of the chunk's geometry
    this.position = options.position || { x: 0, z: 0 }; // Position in the grid
    this.isActive = false; // Whether this chunk is currently active/visible
    this.mesh = null; // The THREE.Mesh for this chunk
  }

  /**
   * Create and return a water mesh for this chunk using the shared material
   * @param {WaterMaterial} sharedMaterial - The shared water material
   * @returns {THREE.Mesh} The created mesh
   */
  createWaterMesh(sharedMaterial) {
    // Create the plane geometry for this chunk
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize, 
      this.chunkSize, 
      this.resolution, 
      this.resolution
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
    
    return this.mesh;
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
      Math.max(4, Math.floor(this.resolution / 8)), // Lower resolution for ground
      Math.max(4, Math.floor(this.resolution / 8))
    );
    
    // For now, just a simple plane below the water
    const terrainMesh = new THREE.Mesh(geometry, groundMaterial);
    terrainMesh.position.set(
      this.position.x * this.chunkSize,
      -0.12, // Set slightly below water level
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