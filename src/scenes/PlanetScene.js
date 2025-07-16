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
        this.exitThreshold = 200; // Distance from planet surface to exit scene
        
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
        // Create planet at origin for this scene
        this.planet = new Planet(this.scene, {
            ...this.planetData,
            position: new THREE.Vector3(0, 0, 0)
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
        
        // Position rocket at a reasonable approach distance
        const approachDistance = this.planet.radius + 140; // Safe distance within exit threshold
        const approachAngle = Math.random() * Math.PI * 2;
        
        this.rocket.mesh.position.set(
            Math.cos(approachAngle) * approachDistance,
            30, // Higher altitude for better camera framing
            Math.sin(approachAngle) * approachDistance
        );
        
        // Clear any velocity from solar system navigation
        this.rocket.velocity.set(0, 0, 0);
        
        console.log(`Rocket positioned at distance ${this.planet.getAltitude(this.rocket.mesh.position)} from ${this.planet.name}`);
        
        // Orient rocket toward planet
        const planetDirection = this.planet.mesh.position.clone().sub(this.rocket.mesh.position).normalize();
        this.rocket.mesh.lookAt(this.planet.mesh.position);
        
        this.gameState = 'approaching';
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
        
        // Calculate camera position to frame both rocket and planet
        const framingDistance = Math.max(distanceToCenter * 0.8, 150); // Minimum distance for close approaches
        const cameraHeight = Math.max(distanceToCenter * 0.6, 100); // Height scales with distance
        
        // Position camera to always see both rocket and planet
        // Camera looks at midpoint from an elevated side position
        const cameraOffset = new THREE.Vector3(
            framingDistance * 0.7, // To the side
            cameraHeight,          // Above
            framingDistance * 0.3  // Slightly back
        );
        
        // For very close approaches, adjust the framing
        if (altitude < 100) {
            // Close to planet - focus more on landing area
            const planetDirection = planetPos.clone().sub(rocketPos).normalize();
            const upDirection = rocketPos.clone().sub(planetPos).normalize();
            const sideDirection = new THREE.Vector3().crossVectors(upDirection, planetDirection).normalize();
            
            // Position camera to show both rocket and landing area
            const desiredPosition = midpoint.clone()
                .add(sideDirection.multiplyScalar(120))
                .add(upDirection.multiplyScalar(80))
                .add(planetDirection.multiplyScalar(-40));
                
            this.cameraPosition.lerp(desiredPosition, this.cameraLerpSpeed);
            this.cameraTarget.lerp(midpoint, this.cameraLerpSpeed);
        } else {
            // Higher altitude - show approach trajectory
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
        
        if (this.gameState === 'approaching' && altitude < 100) {
            this.gameState = 'landing';
        } else if (this.gameState === 'landing' && speed < 1 && altitude < 5) {
            this.gameState = 'landed';
        } else if (this.gameState === 'landed' && speed > 5) {
            this.gameState = 'launching';
        } else if (this.gameState === 'launching' && altitude > 100) {
            this.gameState = 'approaching';
        }
    }
    
    updateRocketOrientation() {
        const altitude = this.planet.getAltitude(this.rocket.mesh.position);
        const speed = this.rocket.getSpeed();
        
        // Auto-orient rocket when close to surface and moving slowly
        if (altitude < 30 && speed < 10) {
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
        
        if (altitude < 100) {
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
        
        // Update rocket with atmospheric effects
        const altitude = this.planet.getAltitude(this.rocket.mesh.position);
        const nearPlanet = altitude < 300;
        
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
        
        // Check for fuel depletion
        if (this.rocket.fuel <= 0 && this.rocket.getSpeed() < 0.1 && altitude > 10) {
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