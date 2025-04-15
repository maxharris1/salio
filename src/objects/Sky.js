import * as THREE from 'three';

export class Sky {
  constructor({ scene }) {
    this.scene = scene;
    
    // Sky dome
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(40, 32, 32),
      new THREE.ShaderMaterial({
        vertexShader: this.vertexShader(),
        fragmentShader: this.fragmentShader(),
        side: THREE.BackSide,
        uniforms: {
          uTopColor: { value: new THREE.Color(0x0077ff) },
          uBottomColor: { value: new THREE.Color(0xffffff) },
          uTopExponent: { value: 0.6 },
          uBottomExponent: { value: 0.1 },
          uOffset: { value: 0.0 },
          uSunPosition: { value: new THREE.Vector3(0, 1, 0) },
          uSunColor: { value: new THREE.Color(0xffffff) },
          uSunSize: { value: 0.2 },
          uTime: { value: 0.0 },
          uDayTime: { value: 0.5 } // 0-1 range (0: night, 0.25: sunrise, 0.5: noon, 0.75: sunset, 1: night)
        }
      })
    );
    
    this.scene.add(this.sky);
    
    // Sun light
    this.sunLight = new THREE.DirectionalLight(0xffffeb, 1.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.1;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -10;
    this.sunLight.shadow.camera.right = 10;
    this.sunLight.shadow.camera.top = 10;
    this.sunLight.shadow.camera.bottom = -10;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);
    
    // Ambient light for night time
    this.ambientLight = new THREE.AmbientLight(0x555566, 0.2);
    this.scene.add(this.ambientLight);
    
    // Create clouds (optional - basic implementation)
    this.createClouds();

    // Create dynamic environment map system
    this.setupDynamicEnvironmentMap();
    
    // Track the last time of day to avoid unnecessary updates
    this.lastDayTimeUpdate = -1;
  }
  
  setupDynamicEnvironmentMap() {
    // Create a cube render target for environment reflections
    // Using lower resolution (256x256) for better performance
    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
      format: THREE.RGBFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });
    
    // Create the cube camera
    this.cubeCamera = new THREE.CubeCamera(0.1, 100, this.cubeRenderTarget);
    
    // Position it at water level
    this.cubeCamera.position.set(0, 0, 0);
    this.scene.add(this.cubeCamera);
    
    // Create a list of objects to exclude when rendering the environment map
    this.objectsToExclude = [];
  }
  
  // Call this method to add objects you want to exclude from the reflection
  excludeFromReflection(object) {
    if (object) {
      this.objectsToExclude.push(object);
    }
  }
  
  updateEnvironmentMap(renderer, dayTime) {
    // Only update the environment map if the time of day has changed significantly
    // or if it's the first update
    if (Math.abs(dayTime - this.lastDayTimeUpdate) > 0.05 || this.lastDayTimeUpdate === -1) {
      // Store objects' original visibility state
      const visibilityStates = [];
      
      // Hide objects that shouldn't appear in reflections
      for (const object of this.objectsToExclude) {
        visibilityStates.push({ obj: object, wasVisible: object.visible });
        object.visible = false;
      }
      
      // Make sure the sky dome is visible
      const skyWasVisible = this.sky.visible;
      this.sky.visible = true;
      
      // Update the cube camera
      this.cubeCamera.update(renderer, this.scene);
      
      // Restore visibility states
      for (let i = 0; i < this.objectsToExclude.length; i++) {
        this.objectsToExclude[i].visible = visibilityStates[i].wasVisible;
      }
      this.sky.visible = skyWasVisible;
      
      // Update the last update time
      this.lastDayTimeUpdate = dayTime;
    }
    
    // Return the environment map texture
    return this.cubeRenderTarget.texture;
  }
  
  // Getter for the environment map texture
  get environmentMap() {
    return this.cubeRenderTarget.texture;
  }
  
  createClouds() {
    const textureLoader = new THREE.TextureLoader();
    
    // Try to load cloud texture, but don't fail if not available
    textureLoader.load('/clouds.png', (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      
      this.cloudsMaterial = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      
      // Create a few cloud planes at different heights and rotations
      for (let i = 0; i < 5; i++) {
        const cloudsPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(20, 20),
          this.cloudsMaterial
        );
        
        cloudsPlane.rotation.x = Math.PI / 2;
        cloudsPlane.position.y = 5 + i * 0.5;
        cloudsPlane.position.x = (Math.random() - 0.5) * 10;
        cloudsPlane.position.z = (Math.random() - 0.5) * 10;
        cloudsPlane.userData.speedFactor = 0.05 + Math.random() * 0.1;
        
        this.scene.add(cloudsPlane);
        
        if (!this.clouds) this.clouds = [];
        this.clouds.push(cloudsPlane);
        
        // Exclude clouds from reflections (optional - can be included if you want)
        this.excludeFromReflection(cloudsPlane);
      }
    }, undefined, () => {
      console.log('Cloud texture not found, skipping clouds');
    });
  }
  
  update(time) {
    // Update time uniform
    this.sky.material.uniforms.uTime.value = time;
    
    // Update sky colors and sun position based on dayTime
    const dayTime = this.sky.material.uniforms.uDayTime.value;
    
    // Calculate sun position
    const sunPosition = new THREE.Vector3();
    const theta = Math.PI * (dayTime * 2 - 0.5);
    sunPosition.x = Math.cos(theta);
    sunPosition.y = Math.sin(theta);
    sunPosition.z = 0.0;
    
    this.sky.material.uniforms.uSunPosition.value = sunPosition;
    this.sunLight.position.copy(sunPosition.clone().multiplyScalar(20));
    
    // Update colors based on time of day
    if (dayTime < 0.25) { // Night to sunrise
      const t = dayTime / 0.25;
      this.sky.material.uniforms.uTopColor.value.setRGB(t * 0.1, t * 0.2, 0.5 - t * 0.2);
      this.sky.material.uniforms.uBottomColor.value.setRGB(t * 0.9, t * 0.6, t * 0.4);
      this.sunLight.intensity = t * 1.5;
      this.sunLight.color.setRGB(1, 0.8 + t * 0.2, 0.7 + t * 0.3);
      this.ambientLight.intensity = 0.2 + t * 0.1;
    } 
    else if (dayTime < 0.5) { // Sunrise to noon
      const t = (dayTime - 0.25) / 0.25;
      this.sky.material.uniforms.uTopColor.value.setRGB(0.1 + t * 0.1, 0.2 + t * 0.4, 0.3 + t * 0.5);
      this.sky.material.uniforms.uBottomColor.value.setRGB(0.9, 0.6 + t * 0.4, 0.4 + t * 0.6);
      this.sunLight.intensity = 1.5;
      this.sunLight.color.setRGB(1, 1, 1);
      this.ambientLight.intensity = 0.3;
    }
    else if (dayTime < 0.75) { // Noon to sunset
      const t = (dayTime - 0.5) / 0.25;
      this.sky.material.uniforms.uTopColor.value.setRGB(0.2 - t * 0.1, 0.6 - t * 0.4, 0.8 - t * 0.3);
      this.sky.material.uniforms.uBottomColor.value.setRGB(0.9, 1.0 - t * 0.4, 1.0 - t * 0.6);
      this.sunLight.intensity = 1.5 - t * 0.5;
      this.sunLight.color.setRGB(1, 1 - t * 0.2, 1 - t * 0.3);
      this.ambientLight.intensity = 0.3 - t * 0.1;
    }
    else { // Sunset to night
      const t = (dayTime - 0.75) / 0.25;
      this.sky.material.uniforms.uTopColor.value.setRGB(0.1 - t * 0.1, 0.2 - t * 0.2, 0.5);
      this.sky.material.uniforms.uBottomColor.value.setRGB(0.9 - t * 0.9, 0.6 - t * 0.6, 0.4 - t * 0.4);
      this.sunLight.intensity = 1.0 - t * 1.0;
      this.sunLight.color.setRGB(1, 0.8 - t * 0.8, 0.7 - t * 0.7);
      this.ambientLight.intensity = 0.2 - t * 0.1;
    }
    
    // Update clouds if they exist
    if (this.clouds) {
      this.clouds.forEach(cloud => {
        cloud.position.x += cloud.userData.speedFactor * 0.01;
        
        // Reset position if cloud moves too far
        if (cloud.position.x > 15) {
          cloud.position.x = -15;
          cloud.position.z = (Math.random() - 0.5) * 10;
        }
      });
    }
  }
  
  vertexShader() {
    return `
      varying vec3 vWorldPosition;
      varying vec3 vPosition;
      
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vPosition = position;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }
  
  fragmentShader() {
    return `
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uTopExponent;
      uniform float uBottomExponent;
      uniform float uOffset;
      uniform vec3 uSunPosition;
      uniform vec3 uSunColor;
      uniform float uSunSize;
      uniform float uTime;
      uniform float uDayTime;
      
      varying vec3 vWorldPosition;
      varying vec3 vPosition;
      
      void main() {
        float h = normalize(vWorldPosition).y + uOffset;
        
        // Mix the sky colors based on height
        vec3 skyColor = mix(
          uBottomColor, 
          uTopColor, 
          pow(max(0.0, h), mix(uBottomExponent, uTopExponent, h))
        );
        
        // Calculate sun disk and glow
        vec3 sunDirection = normalize(uSunPosition);
        vec3 rayDirection = normalize(vPosition);
        
        float sunDisk = max(0.0, dot(rayDirection, sunDirection));
        float sunGlow = pow(sunDisk, 1.0 / uSunSize);
        
        // Sunset/sunrise effect
        float horizonEffect = 1.0 - abs(2.0 * uDayTime - 1.0);
        horizonEffect = pow(horizonEffect, 4.0);
        
        // Apply sun and horizon glow
        if (sunDisk > 0.998) {
          // Sun disk
          skyColor = mix(skyColor, uSunColor, 0.95);
        } else {
          // Sun glow
          skyColor = mix(skyColor, uSunColor, sunGlow * 0.4 * (1.0 - horizonEffect * 0.5));
          
          // Add horizon glow for sunrise/sunset
          if (uDayTime < 0.25 || uDayTime > 0.75) {
            vec3 horizonColor = vec3(0.9, 0.6, 0.3);
            skyColor = mix(skyColor, horizonColor, horizonEffect * max(0.0, 1.0 - abs(h * 10.0)));
          } else if (uDayTime < 0.5 && uDayTime > 0.25) {
            vec3 horizonColor = vec3(0.95, 0.85, 0.5);
            skyColor = mix(skyColor, horizonColor, horizonEffect * 0.5 * max(0.0, 1.0 - abs(h * 10.0)));
          }
        }
        
        // Add subtle stars at night
        if (uDayTime > 0.75 || uDayTime < 0.25) {
          float nightness = uDayTime > 0.75 ? (uDayTime - 0.75) * 4.0 : 1.0 - uDayTime * 4.0;
          
          // Simple noise function for stars
          vec3 starPos = vPosition * 500.0;
          float noise = fract(sin(dot(starPos.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          
          if (noise > 0.995 && rayDirection.y > 0.2) {
            float twinkle = sin(uTime * 3.0 + noise * 10.0) * 0.5 + 0.5;
            skyColor += vec3(1.0) * nightness * twinkle * 0.3;
          }
        }
        
        gl_FragColor = vec4(skyColor, 1.0);
      }
    `;
  }
} 