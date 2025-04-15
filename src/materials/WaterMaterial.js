import * as THREE from 'three';
import waterVertexShader from '../shaders/water.vert?raw';
import waterFragmentShader from '../shaders/water.frag?raw';

export class WaterMaterial extends THREE.ShaderMaterial {
  constructor(options = {}) {
    super({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.8 },
        uEnvironmentMap: { value: options.environmentMap },
        uWavesAmplitude: { value: 0.036 },
        uWavesFrequency: { value: 0.5287 },
        uWavesPersistence: { value: 0.3 },
        uWavesLacunarity: { value: 2.18 },
        uWavesIterations: { value: 8 },
        uWavesSpeed: { value: 0.4 },
        uTroughColor: { value: new THREE.Color(0.01, 0.08, 0.25) },
        uSurfaceColor: { value: new THREE.Color(0.33, 0.69, 0.5) },
        uPeakColor: { value: new THREE.Color(0.5, 0.69, 0.65) },
        uPeakThreshold: { value: 0.08 },
        uPeakTransition: { value: 0.05 },
        uTroughThreshold: { value: -0.015 },
        uTroughTransition: { value: 0.18 },
        uFresnelScale: { value: 0.29 },
        uFresnelPower: { value: 0.5 }
      },
      transparent: true,
      depthTest: true,
      side: THREE.DoubleSide
    });
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }

  updateEnvironmentMap(environmentMap) {
    this.uniforms.uEnvironmentMap.value = environmentMap;
  }

  // Setter methods for UI control
  setOpacity(opacity) {
    this.uniforms.uOpacity.value = opacity;
  }

  setWavesAmplitude(amplitude) {
    this.uniforms.uWavesAmplitude.value = amplitude;
  }

  setWavesFrequency(frequency) {
    this.uniforms.uWavesFrequency.value = frequency;
  }

  setWavesPersistence(persistence) {
    this.uniforms.uWavesPersistence.value = persistence;
  }

  setWavesLacunarity(lacunarity) {
    this.uniforms.uWavesLacunarity.value = lacunarity;
  }

  setWavesIterations(iterations) {
    this.uniforms.uWavesIterations.value = iterations;
  }

  setWavesSpeed(speed) {
    this.uniforms.uWavesSpeed.value = speed;
  }
} 