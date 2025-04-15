/**
 * Enhanced performance stats overlay
 * Displays FPS, active chunks, total vertices, memory usage, and fog diagnostics
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
    this.renderTimeElement = document.createElement('div');
    this.memoryElement = document.createElement('div');
    this.fogTypeElement = document.createElement('div');
    this.cameraPosElement = document.createElement('div');
    
    // Add elements to container
    this.container.appendChild(this.fpsElement);
    this.container.appendChild(this.chunksElement);
    this.container.appendChild(this.verticesElement);
    this.container.appendChild(this.renderTimeElement);
    this.container.appendChild(this.memoryElement);
    this.container.appendChild(this.fogTypeElement);
    this.container.appendChild(this.cameraPosElement);
    
    // Add to DOM
    document.body.appendChild(this.container);
    
    // Initialize tracking variables
    this.frames = 0;
    this.lastTime = performance.now();
    this.fps = 0;
    
    // Create visualization tools container (hidden by default)
    this.createVisualizationTools();
    
    // Visibility toggle
    document.addEventListener('keydown', (e) => {
      if (e.key === '`') { // Backtick key
        this.container.style.display = this.container.style.display === 'none' ? 'block' : 'none';
      }
      if (e.key === 'F1') { // F1 key toggles advanced visualization
        this.toggleVisualizationTools();
      }
    });
    
    // Listen for the custom event to toggle fog visualization
    document.addEventListener('toggle-fog-visualization', () => {
      this.toggleVisualizationTools();
    });
  }
  
  /**
   * Create visualization tools for debugging
   */
  createVisualizationTools() {
    // Container for visualization tools
    this.visualContainer = document.createElement('div');
    this.visualContainer.style.position = 'fixed';
    this.visualContainer.style.bottom = '10px';
    this.visualContainer.style.right = '10px';
    this.visualContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.visualContainer.style.color = 'white';
    this.visualContainer.style.padding = '10px';
    this.visualContainer.style.borderRadius = '5px';
    this.visualContainer.style.fontFamily = 'monospace';
    this.visualContainer.style.width = '300px';
    this.visualContainer.style.display = 'none'; // Hidden by default
    
    // Create fog visualization elements
    this.fogVisualTitle = document.createElement('div');
    this.fogVisualTitle.textContent = 'Fog Visualization';
    this.fogVisualTitle.style.fontWeight = 'bold';
    this.fogVisualTitle.style.marginBottom = '5px';
    
    this.fogHelpText = document.createElement('div');
    this.fogHelpText.textContent = 'Click Toggle Fog Type to switch between exponential and linear fog. Use the slider to adjust density.';
    this.fogHelpText.style.fontSize = '10px';
    this.fogHelpText.style.marginBottom = '10px';
    this.fogHelpText.style.color = '#aaa';
    
    this.fogColorDisplay = document.createElement('div');
    this.fogColorDisplay.style.height = '20px';
    this.fogColorDisplay.style.marginBottom = '10px';
    this.fogColorDisplay.style.border = '1px solid white';
    
    this.fogTypeToggle = document.createElement('button');
    this.fogTypeToggle.textContent = 'Toggle Fog Type';
    this.fogTypeToggle.style.marginRight = '5px';
    this.fogTypeToggle.style.pointerEvents = 'auto';
    
    // Default fog density from main scene (0.1)
    const defaultDensity = 0.1;
    
    this.fogDensitySlider = document.createElement('input');
    this.fogDensitySlider.type = 'range';
    this.fogDensitySlider.min = '0.001';
    this.fogDensitySlider.max = '0.2';
    this.fogDensitySlider.step = '0.001';
    this.fogDensitySlider.value = defaultDensity.toString();
    this.fogDensitySlider.style.width = '100%';
    this.fogDensitySlider.style.pointerEvents = 'auto';
    
    this.fogDensityLabel = document.createElement('div');
    this.fogDensityLabel.textContent = `Fog Density: ${defaultDensity}`;
    
    // Add elements to visualization container
    this.visualContainer.appendChild(this.fogVisualTitle);
    this.visualContainer.appendChild(this.fogHelpText);
    this.visualContainer.appendChild(this.fogColorDisplay);
    this.visualContainer.appendChild(this.fogTypeToggle);
    this.visualContainer.appendChild(this.fogDensityLabel);
    this.visualContainer.appendChild(this.fogDensitySlider);
    
    // Add to DOM
    document.body.appendChild(this.visualContainer);
    
    // Add event listeners
    this.fogTypeToggle.addEventListener('click', () => {
      // This will be connected to the ENABLE_LINEAR_FOG flag in main.js
      document.dispatchEvent(new CustomEvent('toggle-fog-type'));
    });
    
    this.fogDensitySlider.addEventListener('input', (e) => {
      const density = parseFloat(e.target.value);
      this.fogDensityLabel.textContent = `Fog Density: ${density.toFixed(3)}`;
      document.dispatchEvent(new CustomEvent('update-fog-density', { 
        detail: { density } 
      }));
    });
  }
  
  /**
   * Toggle visibility of visualization tools
   */
  toggleVisualizationTools() {
    this.visualContainer.style.display = 
      this.visualContainer.style.display === 'none' ? 'block' : 'none';
  }
  
  /**
   * Update the fog color display in visualization tools
   * @param {THREE.Color} color - Current fog color
   * @param {string} type - Type of fog (exp or linear)
   */
  updateFogVisuals(color, type) {
    if (this.fogColorDisplay) {
      const r = Math.floor(color.r * 255);
      const g = Math.floor(color.g * 255);
      const b = Math.floor(color.b * 255);
      this.fogColorDisplay.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      this.fogTypeElement.textContent = `Fog Type: ${type}`;
    }
  }
  
  /**
   * Update stats display
   * @param {number} time - Current time
   * @param {object} worldManager - The world manager instance
   * @param {object} scene - The THREE.Scene instance (for fog info)
   * @param {object} camera - The camera instance
   */
  update(time, worldManager, scene, camera) {
    const startTime = performance.now();
    
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
    
    // Get memory info if available
    let memoryInfo = '';
    if (performance.memory) {
      const usedJSHeapSize = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      const totalJSHeapSize = Math.round(performance.memory.totalJSHeapSize / (1024 * 1024));
      memoryInfo = `Memory: ${usedJSHeapSize}MB / ${totalJSHeapSize}MB`;
    } else {
      memoryInfo = 'Memory: Not available';
    }
    
    // Get fog type
    let fogType = 'None';
    if (scene && scene.fog) {
      fogType = scene.fog.isFogExp2 ? 'Exponential' : 'Linear';
      
      // Update fog visualization
      this.updateFogVisuals(scene.fog.color, fogType);
    }
    
    // Get camera position
    const cameraPosition = camera ? 
      `Camera: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})` : 
      'Camera: N/A';
    
    // Update display
    this.fpsElement.textContent = `FPS: ${this.fps}`;
    this.chunksElement.textContent = `Active Chunks: ${activeChunks}`;
    this.verticesElement.textContent = `Total Vertices: ${totalVertices.toLocaleString()}`;
    this.renderTimeElement.textContent = `Render Time: ${(performance.now() - startTime).toFixed(2)}ms`;
    this.memoryElement.textContent = memoryInfo;
    this.fogTypeElement.textContent = `Fog Type: ${fogType}`;
    this.cameraPosElement.textContent = cameraPosition;
  }
  
  /**
   * Visualize the camera frustum
   * @param {THREE.Camera} camera - The camera to visualize
   * @param {THREE.Scene} scene - The scene to add the helper to
   */
  visualizeFrustum(camera, scene) {
    // Remove existing helper if any
    if (this.frustumHelper) {
      scene.remove(this.frustumHelper);
    }
    
    // Create and add new helper
    const frustumHelper = new THREE.CameraHelper(camera);
    scene.add(frustumHelper);
    this.frustumHelper = frustumHelper;
    
    return frustumHelper;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    if (this.visualContainer && this.visualContainer.parentNode) {
      this.visualContainer.parentNode.removeChild(this.visualContainer);
    }
    
    if (this.frustumHelper) {
      this.frustumHelper.parent.remove(this.frustumHelper);
      this.frustumHelper.dispose();
    }
  }
  
  /**
   * Set initial fog density for the visualization tools
   * @param {number} density - Initial fog density value
   */
  setInitialFogDensity(density) {
    if (this.fogDensitySlider && this.fogDensityLabel) {
      this.fogDensitySlider.value = density.toString();
      this.fogDensityLabel.textContent = `Fog Density: ${density.toFixed(3)}`;
    }
  }
} 