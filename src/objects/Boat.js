import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

/**
 * Boat class - Creates a 3D model of a wooden sailing ship with physics
 */
export class Boat {
  constructor(options = {}) {
    // Save references to scene and physics world
    this.scene = options.scene;
    this.world = options.world;
    this.getWaveHeight = options.getWaveHeight || ((x, z) => 0); // Default to flat water if not provided
    
    // Physics properties
    this.mass = options.mass || 1200; // kg
    this.waterDensity = options.waterDensity || 1000; // kg/m³
    
    // Group to hold all boat meshes
    this.boatGroup = new THREE.Group();
    
    // Controls state
    this.currentThrust = 0; // Added for thrust control
    
    // Materials
    this.woodMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513, 
      side: THREE.DoubleSide, 
      roughness: 0.85, 
      metalness: 0.1 
    });
    
    this.sailMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xF5F5DC, 
      side: THREE.DoubleSide, 
      roughness: 0.9, 
      metalness: 0 
    });
    
    // Boat dimensions
    this.hullLength = 6;
    this.hullWidth = 1.8;
    this.hullHeight = 1.0;
    this.deckLevel = this.hullHeight / 2;
    this.keelDepth = -this.hullHeight / 2;
    
    this.mastHeight = 7;
    this.mastRadius = 0.08 * 1.3; // Increased mast radius by 30%
    this.boomLength = this.hullLength * 0.5; // Shorter boom (was 0.6)
    this.boomRadius = 0.06;
    this.sailWidth = this.boomLength * 0.95;
    this.sailHeight = this.mastHeight * 0.7;
    
    // Rudder dimensions
    this.rudderHeight = 1.2;
    this.rudderWidth = 0.6;
    this.rudderThickness = 0.05;
    this.rudderAngle = 0; // Current rudder angle in radians
    
    // Helm dimensions
    this.helmRadius = 0.2; // Reduced from 0.3 to 0.2
    this.helmThickness = 0.02; // Reduced from 0.03 to 0.02
    this.helmSpokes = 8; 
    this.helmHandleHeight = 0.045; // Reduced from 0.06 to 0.045
    this.helmPoleHeight = 0.45; // Reduced from 0.7 to 0.45
    this.helmPoleRadius = 0.025; // Reduced from 0.04 to 0.025
    
    // Winch dimensions
    this.winchBaseRadius = 0.06;
    this.winchBaseHeight = 0.02;
    this.winchDrumRadius = 0.05;
    this.winchDrumHeight = 0.08;
    this.winchHandleLength = 0.15;
    this.winchHandleRadius = 0.01;
    this.boomAngle = 0; // Current boom angle in radians
    
    // Create the boat and its physics body
    this.createBoatMesh();
    this.createPhysicsBody();
    
    // Add to scene
    this.scene.add(this.boatGroup);
  }
  
  /**
   * Create the boat meshes
   */
  createBoatMesh() {
    // Hull vertices for ConvexGeometry
    const hullVertices = [
      // Bottom vertices
      new THREE.Vector3(0, this.keelDepth, this.hullLength / 2 * 0.95),                 // Keel Bow Point - moved forward
      new THREE.Vector3(0, this.keelDepth, -this.hullLength / 2 * 0.8),                // Keel Stern Point
      // Reduced width of front chines by 25% and moved them further back
      new THREE.Vector3(-this.hullWidth * 0.3, this.keelDepth * 0.8, this.hullLength * 0.25),// Bottom Front Left Chine
      new THREE.Vector3( this.hullWidth * 0.3, this.keelDepth * 0.8, this.hullLength * 0.25),// Bottom Front Right Chine
      new THREE.Vector3(-this.hullWidth * 0.45, this.keelDepth * 0.6, -this.hullLength * 0.4),// Bottom Rear Left Chine
      new THREE.Vector3( this.hullWidth * 0.45, this.keelDepth * 0.6, -this.hullLength * 0.4),// Bottom Rear Right Chine
      
      // Deck vertices - adjusted to create sharper bow
      new THREE.Vector3(0, this.deckLevel, this.hullLength / 2),                   // Deck Bow Point
      // Reduced width of mid deck points and moved them back slightly
      new THREE.Vector3(-this.hullWidth / 2 * 0.9, this.deckLevel, this.hullLength / 2 * 0.55), // Deck Mid Left
      new THREE.Vector3( this.hullWidth / 2 * 0.9, this.deckLevel, this.hullLength / 2 * 0.55), // Deck Mid Right
      new THREE.Vector3(-this.hullWidth / 2, this.deckLevel, -this.hullLength / 2),      // Deck Stern Left
      new THREE.Vector3( this.hullWidth / 2, this.deckLevel, -this.hullLength / 2),      // Deck Stern Right
    ];
    
    // Create hull using ConvexGeometry
    const hullGeometry = new ConvexGeometry(hullVertices);
    const hullMesh = new THREE.Mesh(hullGeometry, this.woodMaterial);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    this.boatGroup.add(hullMesh);
    
    // Create deck - modified to better match hull shape
    this.createCustomDeck(hullVertices);
    
    // Create rails
    this.createRails(hullVertices);
    
    // Create mast - moved forward with increased diameter
    const mastGeometry = new THREE.CylinderGeometry(this.mastRadius, this.mastRadius * 0.7, this.mastHeight);
    const mastMesh = new THREE.Mesh(mastGeometry, this.woodMaterial);
    mastMesh.position.set(0, this.deckLevel + this.mastHeight / 2, this.hullLength * 0.1); // Moved forward
    mastMesh.castShadow = true;
    this.boatGroup.add(mastMesh);
    
    // Calculate boom height position - lowered by another 20%
    const boomHeightPercent = 0.16; // Lower boom height (was 0.2, now 0.16 - another 20% lower)
    const boomHeight = this.deckLevel + this.mastHeight * boomHeightPercent;
    
    // Create boom - oriented to face the rear, lowered on mast, and aligned with boat axis
    const boomGeometry = new THREE.CylinderGeometry(this.boomRadius, this.boomRadius, this.boomLength);
    const boomMesh = new THREE.Mesh(boomGeometry, this.woodMaterial);
    
    // Create boom group for rotation
    this.boomGroup = new THREE.Group();
    this.boomGroup.position.set(
      0,
      boomHeight,
      mastMesh.position.z
    );
    this.boatGroup.add(this.boomGroup);
    
    // Add boom to boom group
    boomMesh.position.set(0, 0, -this.boomLength/2);
    boomMesh.rotation.x = Math.PI / 2; // Rotate to align with boat's main axis
    boomMesh.castShadow = true;
    this.boomGroup.add(boomMesh);
    
    // Store reference to the boom mesh for rope attachment
    this.boomMesh = boomMesh;
    
    // Create triangular sail (aligned with boom and mast)
    this.createTriangularSail(mastMesh, boomMesh, boomHeight);
    
    // Create rudder
    this.createRudder();
    
    // Create helm (steering wheel)
    this.createHelm();
    
    // Create winches
    this.createWinches();
  }
  
  /**
   * Create a rudder at the stern of the boat
   */
  createRudder() {
    // Create a rudder group to help with rotation
    this.rudderGroup = new THREE.Group();
    
    // Create rudder geometry (flat board)
    const rudderGeometry = new THREE.BoxGeometry(
      this.rudderThickness,
      this.rudderHeight,
      this.rudderWidth
    );
    
    // Create the rudder mesh
    const rudderMesh = new THREE.Mesh(rudderGeometry, this.woodMaterial);
    
    // Position the rudder mesh so half of it is submerged under the hull
    rudderMesh.position.set(
      0,
      -this.rudderHeight / 2 + 0.2, // Raised higher so it connects to hull
      0
    );
    
    // Add rudder mesh to rudder group
    this.rudderGroup.add(rudderMesh);
    
    // Position rudder group at the stern of the boat, partially under the hull
    this.rudderGroup.position.set(
      0,
      this.keelDepth + 0.2, // Position closer to the keel
      -this.hullLength / 2 + 0.1 // Move forward to overlap with hull
    );
    
    // Add rudder group to boat group
    this.boatGroup.add(this.rudderGroup);
  }
  
  /**
   * Create a helm (steering wheel) on the deck
   */
  createHelm() {
    // Create a helm group
    this.helmGroup = new THREE.Group();
    
    // Create steering column/pole
    const poleGeometry = new THREE.CylinderGeometry(
      this.helmPoleRadius, 
      this.helmPoleRadius, 
      this.helmPoleHeight, 
      8
    );
    const poleMesh = new THREE.Mesh(poleGeometry, this.woodMaterial);
    poleMesh.position.set(0, this.helmPoleHeight/2, 0); // Position at base
    this.helmGroup.add(poleMesh);
    
    // Create wheel group (attached to top of pole)
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, this.helmPoleHeight, 0); // Position at top of pole
    // Now wheel is vertical (no x-rotation needed)
    this.helmGroup.add(wheelGroup);
    
    // Outer rim of the wheel
    const outerRimGeometry = new THREE.TorusGeometry(
      this.helmRadius,
      this.helmThickness,
      8,
      24
    );
    const outerRimMesh = new THREE.Mesh(outerRimGeometry, this.woodMaterial);
    wheelGroup.add(outerRimMesh);
    
    // Inner rim for support (smaller)
    const innerRimGeometry = new THREE.TorusGeometry(
      this.helmRadius * 0.7,
      this.helmThickness * 0.8,
      8,
      24
    );
    const innerRimMesh = new THREE.Mesh(innerRimGeometry, this.woodMaterial);
    wheelGroup.add(innerRimMesh);
    
    // Hub at center
    const hubGeometry = new THREE.CylinderGeometry(
      this.helmRadius * 0.15,
      this.helmRadius * 0.15,
      this.helmThickness * 3,
      12
    );
    const hubMesh = new THREE.Mesh(hubGeometry, this.woodMaterial);
    // Rotate hub to align with vertical wheel
    hubMesh.rotation.z = Math.PI/2;
    wheelGroup.add(hubMesh);
    
    // Create spokes with handles
    for (let i = 0; i < this.helmSpokes; i++) {
      const angle = (i / this.helmSpokes) * Math.PI * 2;
      
      // Spoke (from center to rim)
      const spokeGeometry = new THREE.CylinderGeometry(
        this.helmThickness * 0.8,
        this.helmThickness * 0.8,
        this.helmRadius,
        6
      );
      const spokeMesh = new THREE.Mesh(spokeGeometry, this.woodMaterial);
      
      // Position and rotate spoke for vertical wheel
      spokeMesh.position.set(
        Math.sin(angle) * this.helmRadius/2,
        Math.cos(angle) * this.helmRadius/2,
        0
      );
      
      // Rotate spoke to point from center to rim
      spokeMesh.rotation.z = angle + Math.PI/2;
      wheelGroup.add(spokeMesh);
      
      // Create handle for this spoke
      const handleGeometry = new THREE.CylinderGeometry(
        this.helmThickness * 1.0, // Reduced from 1.2 to 1.0
        this.helmThickness * 1.0,
        this.helmHandleHeight,
        8
      );
      
      // Create the handle
      const handleMesh = new THREE.Mesh(handleGeometry, this.woodMaterial);
      
      // Create a sub-group for the handle to fix alignment
      const handleGroup = new THREE.Group();
      wheelGroup.add(handleGroup);
      
      // Position handle group exactly on the rim
      handleGroup.position.set(
        Math.sin(angle) * this.helmRadius,
        Math.cos(angle) * this.helmRadius,
        0
      );
      
      // Rotate handle group to face outward
      handleGroup.lookAt(new THREE.Vector3(
        Math.sin(angle) * (this.helmRadius * 2),
        Math.cos(angle) * (this.helmRadius * 2),
        0
      ));
      
      // Add handle to its group, positioned half its height along local Z
      handleMesh.position.z = this.helmHandleHeight/2;
      handleGroup.add(handleMesh);
    }
    
    // Support bracket connecting to pole
    const bracketGeometry = new THREE.BoxGeometry(
      this.helmRadius * 0.25,
      this.helmRadius * 0.25,
      this.helmThickness * 3
    );
    const bracketMesh = new THREE.Mesh(bracketGeometry, this.woodMaterial);
    bracketMesh.position.set(0, 0, -this.helmThickness * 1.5);
    wheelGroup.add(bracketMesh);
    
    // Position helm on deck and rotate to face forward
    this.helmGroup.position.set(
      0,
      this.deckLevel + 0.03, // Just above deck level
      -this.hullLength / 3.2  // Adjusted position along boat
    );
    
    // Rotate the entire helm group to face forward
    this.helmGroup.rotation.y = Math.PI; // Face toward stern
    
    // Store reference to wheel group for rotation
    this.helmWheelGroup = wheelGroup;
    
    // Add to boat group
    this.boatGroup.add(this.helmGroup);
  }
  
  /**
   * Create a custom deck that better matches the hull shape
   */
  createCustomDeck(hullVertices) {
    // Extract only the upper deck vertices and use them to create a more accurate deck
    // Get the indices of the deck vertices from the hull
    const deckVertexIndices = [6, 7, 8, 9, 10]; // These are the indices of the deck vertices
    
    // Extract just the deck vertices
    const deckOnlyVertices = deckVertexIndices.map(index => hullVertices[index]);
    
    // Create a BufferGeometry for the deck
    const deckGeometry = new THREE.BufferGeometry();
    
    // Define the deck faces (triangles)
    // We'll create a triangular fan from the bow vertex
    const indices = [];
    
    // Triangle 1: Bow, Port Mid, Starboard Mid
    indices.push(0, 1, 2);
    
    // Triangle 2: Bow, Port Mid, Port Stern
    indices.push(0, 1, 3);
    
    // Triangle 3: Bow, Starboard Mid, Starboard Stern
    indices.push(0, 2, 4);
    
    // Triangle 4: Bow, Port Stern, Starboard Stern
    indices.push(0, 3, 4);
    
    // Create a flat array of vertex positions
    const positions = new Float32Array(deckOnlyVertices.length * 3);
    deckOnlyVertices.forEach((vertex, i) => {
      positions[i * 3] = vertex.x;
      positions[i * 3 + 1] = vertex.y - 0.02; // Slightly lower than the hull edge
      positions[i * 3 + 2] = vertex.z;
    });
    
    // Set the attributes
    deckGeometry.setIndex(indices);
    deckGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Calculate normals
    deckGeometry.computeVertexNormals();
    
    // Create the mesh
    const deckMesh = new THREE.Mesh(deckGeometry, this.woodMaterial);
    
    deckMesh.castShadow = false;
    deckMesh.receiveShadow = true;
    this.boatGroup.add(deckMesh);
  }
  
  /**
   * Create a triangular sail aligned with mast and boom
   */
  createTriangularSail(mastMesh, boomMesh, boomHeight) {
    // Get key positions
    const mastZ = mastMesh.position.z;
    
    // Get the effective mastHeight from boom attachment point to sail top
    const mastBoomAttachHeight = boomHeight - this.deckLevel;
    const sailTopHeight = this.mastHeight - mastBoomAttachHeight; // Extend to full mast height (was 0.9)
    
    // Create a simple triangle geometry directly (instead of Shape)
    const sailGeometry = new THREE.BufferGeometry();
    
    // Define vertices in YZ plane (along boat's main axis) - ensure no X offset
    const vertices = new Float32Array([
      // Mast at boom height (x=0)
      0, 0, 0,
      // Top of mast (x=0)
      0, sailTopHeight, 0,
      // End of boom (x=0)
      0, 0, -this.boomLength
    ]);
    
    // Add vertices to geometry
    sailGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    
    // Add face indices (just one triangle)
    sailGeometry.setIndex([0, 1, 2]);
    
    // Calculate normals
    sailGeometry.computeVertexNormals();
    
    // Create mesh
    const sailMesh = new THREE.Mesh(sailGeometry, this.sailMaterial);
    
    // Position at boom attachment point on mast
    sailMesh.position.set(0, 0, 0);
    
    // Store reference for sail animation
    this.sailMesh = sailMesh;
    
    // Store original data for animation
    this.sailMesh.userData.originalHeight = sailTopHeight;
    this.sailMesh.userData.originalScale = this.sailMesh.scale.clone();
    
    this.boomGroup.add(sailMesh);
  }
  
  /**
   * Create the rails along the deck edges
   */
  createRails(hullVertices) {
    const railHeight = 0.3;
    const railThickness = 0.05;
    
    // Define exactly which vertices to use for rails
    const railSegments = [
      // Each pair is [startVertexIndex, endVertexIndex]
      [6, 7],   // Bow to Port Mid
      [6, 8],   // Bow to Starboard Mid
      [7, 9],   // Port Mid to Port Stern
      [8, 10],  // Starboard Mid to Starboard Stern
      [9, 10],  // Port Stern to Starboard Stern (across stern)
    ];
    
    // Create each rail segment
    railSegments.forEach(([startIdx, endIdx]) => {
      const startVertex = hullVertices[startIdx];
      const endVertex = hullVertices[endIdx];
      
      // Calculate rail length and midpoint
      const railLength = startVertex.distanceTo(endVertex);
      const midpoint = new THREE.Vector3()
        .addVectors(startVertex, endVertex)
        .multiplyScalar(0.5);
      
      // Calculate rotation angle around Y axis
      const angle = Math.atan2(
        endVertex.x - startVertex.x, 
        endVertex.z - startVertex.z
      );
      
      // Create rail geometry
      const railGeo = new THREE.BoxGeometry(railThickness, railHeight, railLength);
      const railMesh = new THREE.Mesh(railGeo, this.woodMaterial);
      
      // Position at midpoint and elevate by half the rail height
      railMesh.position.set(
        midpoint.x,
        midpoint.y + railHeight / 2,
        midpoint.z
      );
      
      // Rotate to align with rail direction
      railMesh.rotation.y = angle;
      
      // Enable shadows
      railMesh.castShadow = true;
      
      // Add to boat group
      this.boatGroup.add(railMesh);
    });
  }
  
  /**
   * Create physics body for the boat
   */
  createPhysicsBody() {
    // Use a simple box shape for physics
    const physicsExtents = new CANNON.Vec3(
      this.hullWidth / 2,
      this.hullHeight / 2,
      this.hullLength / 2
    );
    
    const boxShape = new CANNON.Box(physicsExtents);
    
    this.body = new CANNON.Body({
      mass: this.mass,
      shape: boxShape,
      material: new CANNON.Material('boatMaterial'),
      linearDamping: 0.2,  // Reduced from 0.7 for more noticeable movement
      angularDamping: 0.5, // Reduced from 0.9 for more noticeable rotation
      position: new CANNON.Vec3(0, 3, 0), // Start position above water
      collisionFilterGroup: 1, // Ensure collision detection is enabled
      collisionFilterMask: 1   // Ensure collision detection is enabled
    });
    
    // Enable collision response
    this.body.collisionResponse = true;
    
    // Log physics body creation
    console.log('Physics body created:', {
      mass: this.mass,
      dimensions: {
        width: this.hullWidth,
        height: this.hullHeight,
        length: this.hullLength
      },
      position: this.body.position,
      collisionEnabled: this.body.collisionResponse
    });
    
    // Add to physics world
    this.world.addBody(this.body);
    
    // Set up buoyancy force calculation
    this.setupBuoyancy();
  }
  
  /**
   * Setup the buoyancy force calculation
   */
  setupBuoyancy() {
    const gravityMagnitude = Math.abs(this.world.gravity.y);
    
    console.log('Initializing buoyancy system:', {
      mass: this.mass,
      waterDensity: this.waterDensity,
      gravityMagnitude,
      dimensions: {
        width: this.hullWidth,
        height: this.hullHeight,
        length: this.hullLength
      }
    });
    
    // --- Buoyancy logic will be moved to the world preStep event in main.js ---
    // this.body.preStep = () => { ... }; // Remove or comment out this block

    // === START DEBUG LOGGING ===
    // Log confirmation that preStep is NOT assigned here anymore
    const listenerAssigned = typeof this.body.preStep === 'function';
    console.log(`Boat body.preStep function assigned here: ${listenerAssigned}`); // Should be false now
    // === END DEBUG LOGGING ===
  }
  
  /**
   * Apply steering force based on rudder angle
   */
  applyRudderForce() {
    // Get boat's forward direction
    const forward = new CANNON.Vec3(0, 0, 1);
    const worldForward = this.body.quaternion.vmult(forward);
    
    // Get boat's velocity
    const velocity = this.body.velocity;
    const speed = velocity.length();
    
    // Calculate steering force based on rudder angle
    // Use sine of rudder angle to get perpendicular component
    const steeringForceMagnitude = speed * speed * 160 * Math.sin(this.rudderAngle);
    
    // Get boat's right direction
    const right = new CANNON.Vec3(1, 0, 0);
    const worldRight = this.body.quaternion.vmult(right);
    
    // Create steering force
    const steeringForce = worldRight.scale(steeringForceMagnitude);
    
    // Apply force at the stern of the boat
    const sternOffset = new CANNON.Vec3(0, 0, -this.hullLength / 2);
    const worldSternOffset = this.body.quaternion.vmult(sternOffset);
    
    this.body.applyForce(steeringForce, worldSternOffset);
  }
  
  /**
   * Set the rudder angle in degrees (-45 to 45 degrees)
   */
  setRudderAngle(angleDegrees) {
    // Clamp angle between -45 and 45 degrees
    const clampedAngle = Math.max(-45, Math.min(45, angleDegrees));
    
    // Convert to radians
    this.rudderAngle = (clampedAngle * Math.PI) / 180;
    
    // Update rudder visual rotation
    if (this.rudderGroup) {
      this.rudderGroup.rotation.y = this.rudderAngle;
    }
    
    // Update helm visual rotation
    if (this.helmWheelGroup) {
      // Rotate wheel around its y-axis for vertical wheel orientation
      // Use opposite rotation for natural steering feel
      this.helmWheelGroup.rotation.y = -this.rudderAngle * 3;
    }
  }
  
  /**
   * Update the boat position based on physics body
   */
  update() {
    // Update boat mesh position and rotation from physics body
    this.boatGroup.position.copy(this.body.position);
    this.boatGroup.quaternion.copy(this.body.quaternion);
  }
  
  /**
   * Set the sail height (0-1)
   */
  setSailHeight(factor) {
    factor = Math.max(0.01, Math.min(1, factor)); // Clamp between 0.01-1
    
    // For triangular sail, scale in Y direction
    this.sailMesh.scale.y = this.sailMesh.userData.originalScale.y * factor;
    
    // Rotate the sail winch
    if (this.sailWinchGroup) {
      // Rotate the handle proportionally
      const handleGroup = this.sailWinchGroup.children[2]; // The handle group
      handleGroup.rotation.y = factor * Math.PI * 4; // 720 degrees from min to max
    }
  }
  
  /**
   * Set the boom angle in degrees (-45 to 45 degrees)
   */
  setBoomAngle(angleDegrees) {
    // Clamp angle between -45 and 45 degrees
    const clampedAngle = Math.max(-45, Math.min(45, angleDegrees));
    
    // Convert to radians
    this.boomAngle = (clampedAngle * Math.PI) / 180;
    
    // Rotate boom group around y-axis
    if (this.boomGroup) {
      this.boomGroup.rotation.y = this.boomAngle;
    }
    
    // Rotate the boom winch
    if (this.boomWinchGroup) {
      // Map from -45 to 45 degrees to rotation angle
      const normalizedAngle = (clampedAngle + 45) / 90; // 0 to 1
      const handleGroup = this.boomWinchGroup.children[2]; // The handle group
      handleGroup.rotation.y = normalizedAngle * Math.PI * 4; // 720 degrees from min to max
    }
  }
  
  /**
   * Move the boat to a specific position
   */
  setPosition(x, y, z) {
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.update(); // Update mesh position immediately
  }
  
  /**
   * Apply a force to the boat
   */
  applyForce(force, worldPoint) {
    // Make sure body exists
    if (!this.body) {
      console.error('Cannot apply force: physics body not initialized!');
      return;
    }
    
    // Convert THREE.Vector3 to CANNON.Vec3 if needed
    let cannonForce;
    if (force.isVector3) {
      cannonForce = new CANNON.Vec3(force.x, force.y, force.z);
    } else {
      cannonForce = force;
    }
    
    // Make sure worldPoint is valid
    let cannonPoint = new CANNON.Vec3();
    if (worldPoint) {
      if (worldPoint.isVector3) {
        cannonPoint = new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z);
      } else {
        cannonPoint = worldPoint;
      }
    }
    
    // Debug log when force is significant
    if (cannonForce.length() > 100) {
      console.log('Applying significant force:', {
        force: {
          x: cannonForce.x.toFixed(2),
          y: cannonForce.y.toFixed(2),
          z: cannonForce.z.toFixed(2),
          magnitude: cannonForce.length().toFixed(2)
        },
        at: worldPoint ? 'offset point' : 'center',
        position: {
          x: this.body.position.x.toFixed(2),
          y: this.body.position.y.toFixed(2),
          z: this.body.position.z.toFixed(2)
        }
      });
    }
    
    // Apply the force to the physics body
    this.body.applyForce(cannonForce, cannonPoint);
  }
  
  /**
   * Create sail height and boom angle winches on the deck
   */
  createWinches() {
    // Create sail height winch (forward winch)
    const sailWinchGroup = this.createWinch();
    sailWinchGroup.position.set(
      -this.hullWidth * 0.3, // Positioned on port side
      this.deckLevel + this.winchBaseHeight/2, 
      -this.hullLength * 0.1 // Forward of the helm
    );
    this.sailWinchGroup = sailWinchGroup;
    this.boatGroup.add(sailWinchGroup);
    
    // Create boom angle winch (aft winch)
    const boomWinchGroup = this.createWinch();
    boomWinchGroup.position.set(
      this.hullWidth * 0.3, // Positioned on starboard side
      this.deckLevel + this.winchBaseHeight/2, 
      -this.hullLength * 0.25 // Closer to the helm
    );
    this.boomWinchGroup = boomWinchGroup;
    
    this.boatGroup.add(boomWinchGroup);
  }
  
  /**
   * Create a single winch with base, drum and handle
   */
  createWinch() {
    const winchGroup = new THREE.Group();
    
    // Create base
    const baseGeometry = new THREE.CylinderGeometry(
      this.winchBaseRadius,
      this.winchBaseRadius,
      this.winchBaseHeight,
      12
    );
    const baseMesh = new THREE.Mesh(baseGeometry, this.woodMaterial);
    baseMesh.position.y = -this.winchDrumHeight/2;
    winchGroup.add(baseMesh);
    
    // Create drum
    const drumGeometry = new THREE.CylinderGeometry(
      this.winchDrumRadius,
      this.winchDrumRadius,
      this.winchDrumHeight,
      12
    );
    const drumMesh = new THREE.Mesh(drumGeometry, this.woodMaterial);
    winchGroup.add(drumMesh);
    
    // Create handle
    const handleGroup = new THREE.Group();
    winchGroup.add(handleGroup);
    
    // Handle base (top cap)
    const handleBaseGeometry = new THREE.CylinderGeometry(
      this.winchDrumRadius * 0.6,
      this.winchDrumRadius * 0.6,
      this.winchBaseHeight,
      8
    );
    const handleBaseMesh = new THREE.Mesh(handleBaseGeometry, this.woodMaterial);
    handleBaseMesh.position.y = this.winchDrumHeight/2 + this.winchBaseHeight/2;
    handleGroup.add(handleBaseMesh);
    
    // Handle arm (horizontal part)
    const handleArmGeometry = new THREE.CylinderGeometry(
      this.winchHandleRadius,
      this.winchHandleRadius,
      this.winchHandleLength,
      8
    );
    const handleArmMesh = new THREE.Mesh(handleArmGeometry, this.woodMaterial);
    handleArmMesh.rotation.z = Math.PI/2;
    handleArmMesh.position.set(this.winchHandleLength/2, this.winchDrumHeight/2 + this.winchBaseHeight, 0);
    handleGroup.add(handleArmMesh);
    
    // Handle grip (vertical part)
    const handleGripGeometry = new THREE.CylinderGeometry(
      this.winchHandleRadius,
      this.winchHandleRadius,
      this.winchHandleLength * 0.4,
      8
    );
    const handleGripMesh = new THREE.Mesh(handleGripGeometry, this.woodMaterial);
    handleGripMesh.position.set(
      this.winchHandleLength,
      this.winchDrumHeight/2 + this.winchBaseHeight - this.winchHandleLength * 0.2,
      0
    );
    handleGroup.add(handleGripMesh);
    
    return winchGroup;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    // Remove from scene
    this.scene.remove(this.boatGroup);
    
    // Remove from physics world
    this.world.removeBody(this.body);
    
    // Dispose geometries
    this.boatGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
      }
    });
  }
} 