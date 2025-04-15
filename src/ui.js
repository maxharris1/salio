import { Pane } from 'tweakpane';
import * as THREE from 'three';

export function setupUI({ waterMaterial, worldManager, sky, timeOfDay, worldConfig, boat }) {
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

  // Boat controls folder
  if (boat) {
    const boatFolder = pane.addFolder({ title: 'Boat Controls' });
    
    // Steering/Rudder control
    const steeringParams = { rudderAngle: 0 };
    boatFolder.addBinding(steeringParams, 'rudderAngle', {
      min: -45, max: 45, step: 1, label: 'Steering'
    }).on('change', ({ value }) => {
      boat.setRudderAngle(value); // This updates both rudder and helm wheel
    });
    
    // Boom angle control
    const boomParams = { angle: 0 };
    boatFolder.addBinding(boomParams, 'angle', {
      min: -45, max: 45, step: 1, label: 'Boom Angle'
    }).on('change', ({ value }) => {
      boat.setBoomAngle(value); // This also rotates the boom winch
    });
    
    // Sail height control
    const sailParams = { height: 1.0 };
    boatFolder.addBinding(sailParams, 'height', {
      min: 0, max: 1, step: 0.01, label: 'Sail Height'
    }).on('change', ({ value }) => {
      boat.setSailHeight(value); // This also rotates the sail winch
    });
    
    // Position controls
    const positionParams = { 
      x: boat.boatGroup.position.x,
      z: boat.boatGroup.position.z
    };
    
    // Update position params when boat moves
    const updatePositionParams = () => {
      positionParams.x = boat.boatGroup.position.x;
      positionParams.z = boat.boatGroup.position.z;
    };
    
    boatFolder.addBinding(positionParams, 'x', {
      min: -50, max: 50, step: 1, label: 'Position X'
    }).on('change', ({ value }) => {
      boat.setPosition(value, boat.boatGroup.position.y, positionParams.z);
    });
    
    boatFolder.addBinding(positionParams, 'z', {
      min: -50, max: 50, step: 1, label: 'Position Z'
    }).on('change', ({ value }) => {
      boat.setPosition(positionParams.x, boat.boatGroup.position.y, value);
    });
    
    // Reset boat position button
    boatFolder.addButton({ title: 'Reset Position' }).on('click', () => {
      boat.setPosition(5, 2, 5);
      // Reset controls to default values
      steeringParams.rudderAngle = 0;
      boomParams.angle = 0;
      sailParams.height = 1.0;
      // Update UI and boat
      boat.setRudderAngle(0);
      boat.setBoomAngle(0);
      boat.setSailHeight(1.0);
      updatePositionParams();
    });
    
    // Apply wind force button
    boatFolder.addButton({ title: 'Apply Wind Force' }).on('click', () => {
      // Apply a force in the -z direction (simulate wind)
      boat.applyForce(new THREE.Vector3(0, 0, -1000));
    });
  }

  // World settings folder
  const worldFolder = pane.addFolder({ title: 'World' });
  
  // Add fog control
  if (worldManager.scene.fog) {
    worldFolder.addBinding(worldManager.scene.fog, 'density', {
      min: 0.002, max: 0.3, step: 0.01, label: 'Fog Density'
    }).on('change', ({ value }) => {
      console.log(`Fog density changed to ${value}`);
    });
    
    // Add a button to test extreme fog density
    worldFolder.addButton({ title: 'EXTREME FOG (10X)' }).on('click', () => {
      worldManager.scene.fog.density = 0.3; // Very extreme fog
      console.log("Setting EXTREME fog density: 0.3");
    });
    
    // Add a button to restore normal fog density
    worldFolder.addButton({ title: 'Normal Fog' }).on('click', () => {
      worldManager.scene.fog.density = 0.01; // Normal fog
      console.log("Setting normal fog density: 0.01");
    });
    
    // Add a button to log fog status (for debugging)
    worldFolder.addButton({ title: 'Check Fog Status' }).on('click', () => {
      console.log('Current fog status:', 
        worldManager.scene.fog, 
        'Fog Color:', 
        worldManager.scene.fog.color.r.toFixed(2),
        worldManager.scene.fog.color.g.toFixed(2), 
        worldManager.scene.fog.color.b.toFixed(2)
      );
      
      // Also log the distant water plane status
      if (worldManager.distantWaterPlane) {
        console.log('Distant water plane:', 
          worldManager.distantWaterPlane,
          'Material:', 
          worldManager.distantWaterPlane.material
        );
      } else {
        console.log('No distant water plane found');
      }
    });
  }
  
  worldFolder.addBinding(worldConfig, 'chunkSize', { 
    min: 1, max: 10, step: 0.5, label: 'Chunk Size' 
  }).on('change', () => {
    // This would require recreating the world manager, so we just display a note
    console.log('Chunk size changed. Refresh to apply changes.');
  });
  
  // Add Ocean Depth control
  const depthParams = { depth: worldManager.oceanFloorDepth };
  worldFolder.addBinding(depthParams, 'depth', {
    min: -20, max: 0, step: 0.1, label: 'Ocean Depth'
  }).on('change', ({ value }) => {
    worldManager.setOceanFloorDepth(value);
    // Refresh the binding to reflect the actual value set
    pane.refresh(); 
  });
  
  worldFolder.addBinding(worldConfig, 'viewDistance', { 
    min: 1, max: 20, step: 1, label: 'View Distance' 
  }).on('change', ({ value }) => {
    // Use the new safe setter method instead of direct assignment
    worldManager.setViewDistance(value);
    // Update the worldConfig value to match what was actually set
    worldConfig.viewDistance = worldManager.viewDistance;
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

  // Add a button to toggle fog visualization tools
  debugFolder.addButton({ title: 'Toggle Fog Tools' }).on('click', () => {
    // Dispatch a custom event that the Stats class listens for
    document.dispatchEvent(new Event('toggle-fog-visualization'));
    console.log('Toggled fog visualization tools');
  });

  // Add button to show/hide the stats panel
  debugFolder.addButton({ title: 'Toggle Stats Display' }).on('click', () => {
    // Simulate pressing the backtick key to toggle stats
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }));
  });
}