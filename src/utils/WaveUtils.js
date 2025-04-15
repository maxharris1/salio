import * as THREE from 'three';

/**
 * Wave utilities to calculate wave height for physics interactions
 */
export class WaveUtils {
  /**
   * Create a wave height calculator
   * @param {Object} waterMaterial - The water material with wave uniforms
   */
  constructor(waterMaterial) {
    this.waterMaterial = waterMaterial;
  }
  
  /**
   * Calculate the wave height at a specific world position (x,z)
   * This mimics the logic in the water.vert shader's getElevation function
   * 
   * @param {number} x - World X coordinate
   * @param {number} z - World Z coordinate
   * @returns {number} The wave height at this position
   */
  getWaveHeight(x, z) {
    if (!this.waterMaterial || !this.waterMaterial.uniforms) {
      return 0; // Default to 0 if no material is available
    }
    
    // Get wave parameters from the material's uniforms
    const time = this.waterMaterial.uniforms.uTime.value;
    const amplitude = this.waterMaterial.uniforms.uWavesAmplitude.value;
    const speed = this.waterMaterial.uniforms.uWavesSpeed.value;
    const frequency = this.waterMaterial.uniforms.uWavesFrequency.value;
    const persistence = this.waterMaterial.uniforms.uWavesPersistence.value;
    const lacunarity = this.waterMaterial.uniforms.uWavesLacunarity.value;
    const iterations = this.waterMaterial.uniforms.uWavesIterations.value;
    
    // Calculate wave height using the same algorithm as the shader
    let elevation = 0.0;
    let currentAmplitude = 1.0;
    let currentFrequency = frequency;
    
    for (let i = 0; i < iterations; i++) {
      const noiseValue = this.simplex2D(
        x * currentFrequency + time * speed,
        z * currentFrequency + time * speed
      );
      
      elevation += currentAmplitude * noiseValue;
      currentAmplitude *= persistence;
      currentFrequency *= lacunarity;
    }
    
    elevation *= amplitude;
    
    return elevation;
  }
  
  /**
   * 2D Simplex noise implementation
   * This replicates the simplex noise function from the shader
   * Based on Simplex Noise by Stefan Gustavson (https://github.com/stegu/webgl-noise)
   * 
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number} Noise value in range [-1,1]
   */
  simplex2D(x, y) {
    const F2 = 0.366025403784439; // 0.5 * (Math.sqrt(3) - 1)
    const G2 = 0.211324865405187; // (3 - Math.sqrt(3)) / 6
    
    // Skew input space to determine which simplex cell we're in
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    
    // Determine which simplex we're in
    let i1, j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }
    
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    
    // Calculate noise contributions from each corner
    const n0 = this.calculateCornerContribution(x0, y0, i, j);
    const n1 = this.calculateCornerContribution(x1, y1, i + i1, j + j1);
    const n2 = this.calculateCornerContribution(x2, y2, i + 1, j + 1);
    
    // Scale to [-1,1]
    return 38.0 * (n0 + n1 + n2);
  }
  
  /**
   * Calculate the contribution from a single corner
   */
  calculateCornerContribution(x, y, i, j) {
    const t = 0.5 - x * x - y * y;
    if (t < 0) return 0.0;
    
    // Hash the coordinates to get gradient
    const hash = this.hash2D(i, j);
    
    // Fetch gradient components
    const [gx, gy] = this.getGradient(hash);
    
    // Calculate dot product
    return Math.pow(t, 4) * (gx * x + gy * y);
  }
  
  /**
   * Hash function for gradient lookup
   */
  hash2D(i, j) {
    // Simple consistent hash function that wraps to give 0-15
    return ((i * 1597 + j * 6971) % 289) % 16;
  }
  
  /**
   * Get gradient vector for hash value
   */
  getGradient(hash) {
    // Pre-defined gradient vectors for consistent behavior
    const gradients = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    
    const grad = gradients[hash];
    return [grad[0], grad[1]];
  }
} 