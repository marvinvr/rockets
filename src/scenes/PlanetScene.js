import * as THREE from 'three';
import { Physics } from '../utils/Physics.js';
import { EdgeIndicators } from '../utils/EdgeIndicators.js';
import { Rocket } from '../objects/Rocket.js';
import { Planet } from '../objects/Planet.js';

export class PlanetScene {
    constructor(planetData, inputHandler) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.inputHandler = inputHandler;
        this.physics = new Physics();
        this.edgeIndicators = new EdgeIndicators();
        
        // Planet-specific data
        this.planetData = planetData;
        this.planet = null;
        this.rocket = null;
        
        // Camera controls
        this.cameraOffset = new THREE.Vector3(0, 10, 20);
        this.cameraTarget = new THREE.Vector3();
        this.cameraPosition = new THREE.Vector3();
        this.cameraLerpSpeed = 0.12; // More responsive camera
        
        // Scene transition parameters
        this.exitThreshold = 1600; // Distance from planet surface to exit scene (8x larger for bigger planets)
        
        this.gameState = 'approaching'; // 'approaching', 'landing', 'landed', 'launching'
        
        this.init();
    }
    
    init() {
        // Setup lighting optimized for single planet
        this.setupLighting();
        
        // Create local starfield
        this.createLocalStarfield();
        
        // Create the planet
        this.createPlanet();
        
        // Create rocket (will be positioned via transfer method)
        this.createRocket();
        
        // Setup initial camera
        this.updateCamera();
    }
    
    setupLighting() {
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Sun light - positioned to illuminate the planet
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(1000, 1000, 500);
        sunLight.castShadow = true;
        sunLight.shadow.camera.left = -500;
        sunLight.shadow.camera.right = 500;
        sunLight.shadow.camera.top = 500;
        sunLight.shadow.camera.bottom = -500;
        sunLight.shadow.camera.near = 100;
        sunLight.shadow.camera.far = 3000;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);
        
        // Additional point light for rocket illumination
        const rocketLight = new THREE.PointLight(0xffffff, 0.3, 200);
        this.scene.add(rocketLight);
        this.rocketLight = rocketLight;
    }
    
    createLocalStarfield() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.0,
            transparent: true
        });
        
        const starsVertices = [];
        for (let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
    }
    
    createPlanet() {
        // Create planet at origin for this scene with much larger radius for takeoff feel
        this.planet = new Planet(this.scene, {
            ...this.planetData,
            position: new THREE.Vector3(0, 0, 0),
            radius: this.planetData.radius * 8 // Make planets 8x larger for better takeoff experience
        });
        
        // Add planet to edge indicators so we can see arrow when off-screen
        this.edgeIndicators.addPlanet(this.planet);
    }
    
    createRocket() {
        this.rocket = new Rocket(this.scene);
        // Position will be set by transfer method
    }
    
    transferRocketFromSolarSystem(solarSystemRocket) {
        // Transfer rocket state from solar system scene
        this.rocket.fuel = solarSystemRocket.fuel;
        this.rocket.velocity.copy(solarSystemRocket.velocity);
        
        // Position rocket on the planet surface at a consistent angle
        const landingAngle = Math.PI * 0.25; // Fixed 45-degree landing position
        const surfaceDistance = this.planet.radius + 2; // Just above surface
        
        this.rocket.mesh.position.set(
            Math.cos(landingAngle) * surfaceDistance,
            0, // On the surface
            Math.sin(landingAngle) * surfaceDistance
        );
        
        // Clear any velocity from solar system navigation
        this.rocket.velocity.set(0, 0, 0);
        
        // Orient rocket upward from planet surface
        this.planet.orientRocketOnSurface(this.rocket);
        
        // Deploy landing gear since we're on the surface
        this.rocket.deployLandingGear();
        
        console.log(`Rocket landed on ${this.planet.name} surface at altitude ${this.planet.getAltitude(this.rocket.mesh.position)}`);
        
        this.gameState = 'landed';
        this.updateCamera();
    }
    
    isRocketLeavingPlanet() {
        const distanceFromSurface = this.planet.getAltitude(this.rocket.mesh.position);
        if (distanceFromSurface > this.exitThreshold) {
            console.log(`Rocket leaving ${this.planet.name} at distance ${distanceFromSurface}`);
        }
        return distanceFromSurface > this.exitThreshold;
    }
    
    updateCamera() {
        const rocketPos = this.rocket.mesh.position;
        const planetPos = this.planet.mesh.position;
        const altitude = this.planet.getAltitude(rocketPos);
        
        // Calculate the midpoint between rocket and planet
        const midpoint = new THREE.Vector3().addVectors(rocketPos, planetPos).multiplyScalar(0.5);
        
        // Calculate distance between rocket and planet
        const rocketToPlanet = planetPos.clone().sub(rocketPos);
        const distanceToCenter = rocketToPlanet.length();
        
        // Use consistent camera angle (45 degrees offset from approach angle)
        const cameraAngle = Math.PI * 0.75; // 135 degrees - gives cinematic side view
        const framingDistance = Math.max(distanceToCenter * 0.8, 1200); // Increased for larger planets
        const cameraHeight = Math.max(distanceToCenter * 0.6, 800); // Increased for larger planets
        
        // Adjust camera based on game state and altitude
        if (this.gameState === 'landed' || altitude < 160) { // Increased from 20 to 160 for larger planets
            // Ground/landing view - close-up focus on rocket
            const upDirection = rocketPos.clone().sub(planetPos).normalize();
            const sideDirection = new THREE.Vector3(
                Math.cos(cameraAngle),
                0,
                Math.sin(cameraAngle)
            ).normalize();
            
            // Position camera much closer to rocket for intimate ground view
            const desiredPosition = rocketPos.clone()
                .add(sideDirection.multiplyScalar(80))  // Reduced from 400 to 80 - much closer
                .add(upDirection.multiplyScalar(40))    // Reduced from 240 to 40 - lower angle
                .add(sideDirection.clone().multiplyScalar(-20)); // Reduced from -80 to -20
                
            this.cameraPosition.lerp(desiredPosition, this.cameraLerpSpeed);
            this.cameraTarget.lerp(rocketPos, this.cameraLerpSpeed);
        } else if (altitude < 800) { // Increased from 100 to 800 for larger planets
            // Close to planet - focus more on landing area with consistent angle
            const planetDirection = planetPos.clone().sub(rocketPos).normalize();
            const upDirection = rocketPos.clone().sub(planetPos).normalize();
            
            // Maintain consistent side angle for landing shots
            const sideDirection = new THREE.Vector3(
                Math.cos(cameraAngle),
                0,
                Math.sin(cameraAngle)
            ).normalize();
            
            // Position camera to show both rocket and landing area (scaled up)
            const desiredPosition = midpoint.clone()
                .add(sideDirection.multiplyScalar(960))  // Increased from 120 to 960
                .add(upDirection.multiplyScalar(640))    // Increased from 80 to 640
                .add(planetDirection.multiplyScalar(-320)); // Increased from -40 to -320
                
            this.cameraPosition.lerp(desiredPosition, this.cameraLerpSpeed);
            this.cameraTarget.lerp(midpoint, this.cameraLerpSpeed);
        } else {
            // Higher altitude - consistent cinematic approach angle
            const cameraOffset = new THREE.Vector3(
                Math.cos(cameraAngle) * framingDistance * 0.7,
                cameraHeight,
                Math.sin(cameraAngle) * framingDistance * 0.7
            );
            
            const desiredPosition = midpoint.clone().add(cameraOffset);
            this.cameraPosition.lerp(desiredPosition, this.cameraLerpSpeed);
            this.cameraTarget.lerp(midpoint, this.cameraLerpSpeed);
        }
        
        this.camera.position.copy(this.cameraPosition);
        this.camera.lookAt(this.cameraTarget);
        
        // Ensure consistent up vector
        this.camera.up.set(0, 1, 0);
        
        // Update rocket light position
        if (this.rocketLight) {
            this.rocketLight.position.copy(rocketPos);
        }
    }
    
    updateGameState() {
        const altitude = this.planet.getAltitude(this.rocket.mesh.position);
        const speed = this.rocket.getSpeed();
        
        if (this.gameState === 'approaching' && altitude < 800) { // Increased from 100 to 800
            this.gameState = 'landing';
        } else if (this.gameState === 'landing' && speed < 1 && altitude < 40) { // Increased from 5 to 40
            this.gameState = 'landed';
        } else if (this.gameState === 'landed' && speed > 5) {
            this.gameState = 'launching';
        } else if (this.gameState === 'launching' && altitude > 800) { // Increased from 100 to 800
            this.gameState = 'approaching';
        }
    }
    
    updateRocketOrientation() {
        const altitude = this.planet.getAltitude(this.rocket.mesh.position);
        const speed = this.rocket.getSpeed();
        
        // Auto-orient rocket when close to surface and moving slowly (scaled for larger planets)
        if (altitude < 240 && speed < 10) { // Increased from 30 to 240
            const planetCenter = this.planet.mesh.position;
            const rocketPosition = this.rocket.mesh.position;
            
            // Calculate up direction from planet center
            const upDirection = rocketPosition.clone().sub(planetCenter).normalize();
            
            // Create target orientation
            const targetQuaternion = new THREE.Quaternion();
            const targetMatrix = new THREE.Matrix4();
            
            const up = upDirection.clone();
            const forward = new THREE.Vector3(0, 0, 1);
            const right = new THREE.Vector3().crossVectors(up, forward).normalize();
            
            if (right.length() < 0.1) {
                forward.set(1, 0, 0);
                right.crossVectors(up, forward).normalize();
            }
            
            forward.crossVectors(right, up).normalize();
            targetMatrix.makeBasis(right, up, forward);
            targetQuaternion.setFromRotationMatrix(targetMatrix);
            
            // Smooth interpolation
            this.rocket.mesh.quaternion.slerp(targetQuaternion, 0.03);
        }
    }
    
    updateLandingGear() {
        const altitude = this.planet.getAltitude(this.rocket.mesh.position);
        
        if (altitude < 800) { // Increased from 100 to 800 for larger planets
            this.rocket.deployLandingGear();
        } else {
            this.rocket.retractLandingGear();
        }
    }
    
    update(deltaTime) {
        // Handle input
        const movement = this.inputHandler.getMovementInput();
        
        // Apply thrust
        if (movement.boost) {
            this.rocket.applyMainThrust(deltaTime, '3d');
        }
        
        // Apply RCS controls - more responsive and always available
        const rcsDirection = new THREE.Vector3();
        const rotationInput = new THREE.Vector3();
        
        // Directional thrust
        if (movement.forward) rcsDirection.z -= 0.25;
        if (movement.backward) rcsDirection.z += 0.25;
        if (movement.left) rcsDirection.x -= 0.25;
        if (movement.right) rcsDirection.x += 0.25;
        
        // Rotation controls - more responsive
        if (movement.forward) rotationInput.x += 0.8;  // Pitch down
        if (movement.backward) rotationInput.x -= 0.8; // Pitch up
        if (movement.left) rotationInput.z += 0.8;     // Roll left
        if (movement.right) rotationInput.z -= 0.8;    // Roll right
        
        // Deceleration thrust
        if (movement.decelerate) {
            const velocity = this.rocket.velocity.clone().normalize().negate();
            rcsDirection.add(velocity.multiplyScalar(0.4));
        }
        
        // Apply RCS thrust
        if (rcsDirection.length() > 0) {
            rcsDirection.normalize();
            this.rocket.applyRCSThrust(rcsDirection, deltaTime, '3d');
        }
        
        // Apply rotation directly to rocket for more responsive controls
        if (rotationInput.length() > 0) {
            this.rocket.angularVelocity.add(rotationInput.multiplyScalar(deltaTime * 3));
        }
        
        // Apply gravity
        const gravity = this.physics.applyGravity(this.rocket, this.planet);
        
        // Update rocket with atmospheric effects (scaled for larger planets)
        const altitude = this.planet.getAltitude(this.rocket.mesh.position);
        const nearPlanet = altitude < 2400; // Increased from 300 to 2400 for larger planets
        
        this.rocket.update(deltaTime, gravity, nearPlanet, '3d');
        this.planet.update(deltaTime);
        
        // Update game state
        this.updateGameState();
        
        // Update rocket orientation when close to planet
        this.updateRocketOrientation();
        
        // Update landing gear
        this.updateLandingGear();
        
        // Update camera
        this.updateCamera();
        
        // Update edge indicators to show arrow to planet when off-screen
        this.edgeIndicators.update(this.camera, [this.planet]);
        
        // Check for landing
        this.checkLanding();
        
        // Check for fuel depletion (scaled for larger planets)
        if (this.rocket.fuel <= 0 && this.rocket.getSpeed() < 0.1 && altitude > 80) { // Increased from 10 to 80
            this.onGameOver('Out of fuel!');
        }
    }
    
    updateHUD() {
        const altitude = this.planet.getAltitude(this.rocket.mesh.position);
        
        document.getElementById('altitude').textContent = Math.floor(Math.max(0, altitude));
        
        const targetInfo = document.getElementById('targetInfo');
        if (targetInfo) {
            targetInfo.innerHTML = `
                <strong>Current: ${this.planet.name}</strong><br>
                ${this.planet.description}<br>
                Gravity: ${this.planet.gravity}g<br>
                Difficulty: ${this.planet.difficulty}/10<br>
                <strong>Planet View</strong>
            `;
        }
    }
    
    checkLanding() {
        const landingResult = this.planet.checkLanding(this.rocket);
        if (landingResult === 'success') {
            this.onLandingSuccess();
        } else if (landingResult === 'crash') {
            this.onGameOver('Crashed! Landing speed too high.');
        }
    }
    
    onLandingSuccess() {
        // Handle successful landing
        console.log(`Successfully landed on ${this.planet.name}!`);
        
        // Reset rocket position after a delay
        setTimeout(() => {
            this.rocket.reset();
            this.planet.orientRocketOnSurface(this.rocket);
            this.gameState = 'launching';
        }, 2000);
    }
    
    onGameOver(message) {
        console.log('Game Over:', message);
        document.getElementById('gameOverText').textContent = message;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
    
    // Get rocket for external access
    getRocket() {
        return this.rocket;
    }
    
    // Get planet data for external access
    getPlanet() {
        return this.planet;
    }
}