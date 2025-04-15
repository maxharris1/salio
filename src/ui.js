import { Pane } from 'tweakpane';
import * as THREE from 'three';

export function setupUI({ waterMaterial, worldManager, sky, timeOfDay, worldConfig }) {
  const pane = new Pane();

  // Time of day folder
  const timeFolder = pane.addFolder({ title: 'Time & Sky' });
  
  timeFolder.addBinding(timeOfDay, 'value', {
    min: 0, max: 1, step: 0.01, label: 'Time of Day'
  }).on('change', ({ value }) => {
    // Update the sky with new time of day
    sky.sky.material.uniforms.uDayTime.value = value;
  });
  
  const skyFolder = timeFolder.addFolder({ title: 'Sky Settings' });
  
  skyFolder.addBinding(sky.sky.material.uniforms.uTopExponent, 'value', {
    min: 0.1, max: 1.0, step: 0.01, label: 'Sky Gradient'
  });
  
  skyFolder.addBinding(sky.sky.material.uniforms.uSunSize, 'value', {
    min: 0.05, max: 0.5, step: 0.01, label: 'Sun Size'
  });
  
  skyFolder.addBinding(sky.sunLight, 'intensity', {
    min: 0, max: 3, step: 0.1, label: 'Sun Intensity'
  });

  // World settings folder
  const worldFolder = pane.addFolder({ title: 'World' });
  
  worldFolder.addBinding(worldConfig, 'chunkSize', { 
    min: 1, max: 10, step: 0.5, label: 'Chunk Size' 
  }).on('change', () => {
    // This would require recreating the world manager, so we just display a note
    console.log('Chunk size changed. Refresh to apply changes.');
  });
  
  worldFolder.addBinding(worldConfig, 'viewDistance', { 
    min: 1, max: 20, step: 1, label: 'View Distance' 
  }).on('change', ({ value }) => {
    worldManager.viewDistance = value;
    // Force update of active chunks
    worldManager.lastCameraChunkPosition.x = Infinity;
  });
  
  worldFolder.addBinding(worldConfig, 'resolution', { 
    min: 32, max: 512, step: 16, label: 'Water Resolution' 
  }).on('change', () => {
    // Display a note that this requires reloading
    console.log('Resolution changed. Refresh to apply changes.');
  });

  // Water parameters folder
  const waterFolder = pane.addFolder({ title: 'Water' });

  // Waves
  const wavesFolder = waterFolder.addFolder({ title: 'Waves' });
  wavesFolder.addBinding(waterMaterial.uniforms.uWavesAmplitude, 'value', {
    min: 0, max: 0.1, label: 'Amplitude'
  });
  wavesFolder.addBinding(waterMaterial.uniforms.uWavesFrequency, 'value', {
    min: 0.1, max: 10, label: 'Frequency'
  });
  wavesFolder.addBinding(waterMaterial.uniforms.uWavesPersistence, 'value', {
    min: 0, max: 1, label: 'Persistence'
  });
  wavesFolder.addBinding(waterMaterial.uniforms.uWavesLacunarity, 'value', {
    min: 0, max: 3, label: 'Lacunarity'
  });
  wavesFolder.addBinding(waterMaterial.uniforms.uWavesIterations, 'value', {
    min: 1, max: 10, step: 1, label: 'Iterations'
  });
  wavesFolder.addBinding(waterMaterial.uniforms.uWavesSpeed, 'value', {
    min: 0, max: 1, label: 'Speed'
  });

  // Color
  const colorFolder = waterFolder.addFolder({ title: 'Color' });

  colorFolder.addBinding(waterMaterial.uniforms.uOpacity, 'value', {
    min: 0, max: 1, step: 0.01, label: 'Opacity'
  });

  colorFolder.addBinding(waterMaterial.uniforms.uTroughColor, 'value', {
    label: 'Trough Color', view: 'color', color: { type: 'float' }
  });
  colorFolder.addBinding(waterMaterial.uniforms.uSurfaceColor, 'value', {
    label: 'Surface Color', view: 'color', color: { type: 'float' }
  });
  colorFolder.addBinding(waterMaterial.uniforms.uPeakColor, 'value', {
    label: 'Peak Color',
    view: 'color',
    color: { type: 'float' }
  });
  colorFolder.addBinding(waterMaterial.uniforms.uPeakThreshold, 'value', {
    min: 0,
    max: 0.5,
    label: 'Peak Threshold'
  });
  colorFolder.addBinding(waterMaterial.uniforms.uPeakTransition, 'value', {
    min: 0,
    max: 0.5,
    label: 'Peak Transition'
  });
  colorFolder.addBinding(waterMaterial.uniforms.uTroughThreshold, 'value', {
    min: -0.5,
    max: 0,
    label: 'Trough Threshold'
  });
  colorFolder.addBinding(waterMaterial.uniforms.uTroughTransition, 'value', {
    min: 0,
    max: 0.5,
    label: 'Trough Transition'
  });

  // Fresnel
  const fresnelFolder = waterFolder.addFolder({ title: 'Fresnel' });
  fresnelFolder.addBinding(waterMaterial.uniforms.uFresnelScale, 'value', {
    min: 0,
    max: 1,
    label: 'Scale'
  });
  fresnelFolder.addBinding(waterMaterial.uniforms.uFresnelPower, 'value', {
    min: 0,
    max: 3,
    label: 'Power'
  });

  // For now, we don't include the caustics controls as they're part of the
  // ground shader that will need to be adapted to work with chunking
  // If/when caustics are reimplemented with chunking, they can be added back
  
  // You might add a button to help debugging/visualizing chunks
  const debugFolder = pane.addFolder({ title: 'Debug' });
  
  const debugParams = { showChunkBorders: false };
  debugFolder.addBinding(debugParams, 'showChunkBorders').on('change', ({ value }) => {
    console.log(`Debug chunk borders: ${value ? 'enabled' : 'disabled'}`);
    // Implementation of debug visualization would go here
  });
}