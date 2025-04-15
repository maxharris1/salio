/**
 * Simple performance stats overlay
 * Displays FPS, active chunks, and total vertices
 */
export class Stats {
  constructor() {
    // Create container
    this.container = document.createElement('div');
    this.container.style.position = 'fixed';
    this.container.style.top = '10px';
    this.container.style.left = '10px';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.container.style.color = 'white';
    this.container.style.padding = '10px';
    this.container.style.borderRadius = '5px';
    this.container.style.fontFamily = 'monospace';
    this.container.style.fontSize = '12px';
    this.container.style.zIndex = '1000';
    this.container.style.width = '200px';
    this.container.style.pointerEvents = 'none'; // Don't block mouse events
    
    // Create stat elements
    this.fpsElement = document.createElement('div');
    this.chunksElement = document.createElement('div');
    this.verticesElement = document.createElement('div');
    this.lastTimeElement = document.createElement('div');
    
    // Add elements to container
    this.container.appendChild(this.fpsElement);
    this.container.appendChild(this.chunksElement);
    this.container.appendChild(this.verticesElement);
    this.container.appendChild(this.lastTimeElement);
    
    // Add to DOM
    document.body.appendChild(this.container);
    
    // Initialize tracking variables
    this.frames = 0;
    this.lastTime = performance.now();
    this.fps = 0;
    
    // Visibility toggle
    document.addEventListener('keydown', (e) => {
      if (e.key === '`') { // Backtick key
        this.container.style.display = this.container.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
  
  /**
   * Update stats display
   * @param {number} time - Current time
   * @param {object} worldManager - The world manager instance
   */
  update(time, worldManager) {
    // Update frame counter
    this.frames++;
    
    // Check if a second has passed
    const currentTime = performance.now();
    if (currentTime > this.lastTime + 1000) {
      // Calculate FPS and reset counter
      this.fps = Math.round((this.frames * 1000) / (currentTime - this.lastTime));
      this.frames = 0;
      this.lastTime = currentTime;
    }
    
    // Count active chunks
    const activeChunks = worldManager.activeChunks.size;
    
    // Calculate total vertices
    let totalVertices = 0;
    for (const chunk of worldManager.activeChunks.values()) {
      if (chunk.mesh && chunk.mesh.geometry) {
        totalVertices += chunk.mesh.geometry.attributes.position.count;
      }
      if (chunk.terrainMesh && chunk.terrainMesh.geometry) {
        totalVertices += chunk.terrainMesh.geometry.attributes.position.count;
      }
    }
    
    // Update display
    this.fpsElement.textContent = `FPS: ${this.fps}`;
    this.chunksElement.textContent = `Active Chunks: ${activeChunks}`;
    this.verticesElement.textContent = `Total Vertices: ${totalVertices.toLocaleString()}`;
    this.lastTimeElement.textContent = `Render Time: ${(performance.now() - currentTime).toFixed(2)}ms`;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 