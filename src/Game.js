import * as THREE from 'three';
import { Physics } from './utils/Physics.js';
import { InputHandler } from './utils/InputHandler.js';
import { EdgeIndicators } from './utils/EdgeIndicators.js';
import { Rocket } from './objects/Rocket.js';
import { Planet } from './objects/Planet.js';
import { AsteroidField } from './objects/Asteroid.js';
import { getTargetForLevel, getPlanetByName, SOLAR_SYSTEM } from './data/SolarSystem.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('gameCanvas'),
            antialias: true 
        });
        
        this.clock = new THREE.Clock();
        this.physics = new Physics();
        this.inputHandler = new InputHandler();
        this.edgeIndicators = new EdgeIndicators();
        
        this.gameState = 'launch';
        this.score = 0;
        this.planetsVisited = 0;
        this.currentLevel = 1;
        
        // Add 2D/3D mode switching
        this.viewMode = '3d'; // '2d' or '3d'
        this.planetaryProximityThreshold = 300; // Distance to switch to 3D mode
        
        this.cameraOffset = new THREE.Vector3(0, 10, 20);
        
        this.setupMiniMap();
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.scene.fog = new THREE.Fog(0x000000, 1000, 5000);
        
        this.setupLighting();
        this.createStarfield();
        this.createGameObjects();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupMiniMap() {
        this.miniMapCanvas = document.getElementById('miniMapCanvas');
        this.miniMapCtx = this.miniMapCanvas.getContext('2d');
        this.miniMapScale = 0.02; // Scale factor for distances
        this.miniMapCenter = { x: 115, y: 95 }; // Center of mini-map
    }

    updateMiniMap() {
        const ctx = this.miniMapCtx;
        const canvas = this.miniMapCanvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background grid
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= canvas.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        for (let i = 0; i <= canvas.height; i += 20) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
        
        // Draw Sun at center
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(this.miniMapCenter.x, this.miniMapCenter.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw orbital paths for inner planets
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.lineWidth = 1;
        const orbitalRadii = [800, 1200, 1500, 2000].map(r => r * this.miniMapScale);
        orbitalRadii.forEach(radius => {
            ctx.beginPath();
            ctx.arc(this.miniMapCenter.x, this.miniMapCenter.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
        });
        
        // Draw planets based on solar system data
        SOLAR_SYSTEM.planets.forEach(planet => {
            const angle = Date.now() * planet.orbitalSpeed * 0.001; // Simple orbital animation
            const x = this.miniMapCenter.x + Math.cos(angle) * planet.distanceFromSun * this.miniMapScale;
            const y = this.miniMapCenter.y + Math.sin(angle) * planet.distanceFromSun * this.miniMapScale;
            
            // Color based on planet
            const colors = {
                'Mercury': '#8C7853',
                'Venus': '#FFC649',
                'Earth': '#4488ff',
                'Mars': '#cc4433',
                'Jupiter': '#D8CA9D',
                'Saturn': '#FAD5A5',
                'Uranus': '#4FD0E7',
                'Neptune': '#4169E1'
            };
            
            ctx.fillStyle = colors[planet.name] || '#888888';
            
            // Size based on planet radius
            const size = Math.max(2, planet.radius * 0.05);
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();
            
            // Label for closer planets
            if (planet.distanceFromSun < 3000) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(planet.name, x, y - size - 2);
            }
        });
        
        // Highlight target planet
        if (this.targetPlanet) {
            const targetPos = this.targetPlanet.mesh.position;
            const targetX = this.miniMapCenter.x + targetPos.x * this.miniMapScale;
            const targetY = this.miniMapCenter.y + targetPos.z * this.miniMapScale;
            
            // Draw pulsing target indicator
            const pulseSize = 6 + Math.sin(Date.now() * 0.005) * 2;
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(targetX, targetY, pulseSize, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Draw target label
            ctx.fillStyle = '#ff4444';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('TARGET', targetX, targetY - 12);
        }
        
        // Draw rocket position and direction
        const rocketPos = this.rocket.mesh.position;
        const rocketX = this.miniMapCenter.x + rocketPos.x * this.miniMapScale;
        const rocketY = this.miniMapCenter.y + rocketPos.z * this.miniMapScale;
        
        // Draw rocket as a triangle pointing in direction of movement
        const velocity = this.rocket.velocity;
        const angle = Math.atan2(velocity.z, velocity.x);
        const rocketSize = 3;
        
        ctx.fillStyle = '#00ff00';
        ctx.save();
        ctx.translate(rocketX, rocketY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(rocketSize, 0);
        ctx.lineTo(-rocketSize, -rocketSize);
        ctx.lineTo(-rocketSize, rocketSize);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        
        // Draw rocket trail from Earth
        const earthAngle = 0; // Earth is stationary in this simplified view
        const earthX = this.miniMapCenter.x + Math.cos(earthAngle) * 1500 * this.miniMapScale;
        const earthY = this.miniMapCenter.y + Math.sin(earthAngle) * 1500 * this.miniMapScale;
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(earthX, earthY);
        ctx.lineTo(rocketX, rocketY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw velocity vector
        if (velocity.length() > 0.1) {
            const velScale = 500;
            const velX = rocketX + velocity.x * velScale;
            const velY = rocketY + velocity.z * velScale;
            
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(rocketX, rocketY);
            ctx.lineTo(velX, velY);
            ctx.stroke();
            
            // Arrow head for velocity
            ctx.fillStyle = '#ffff00';
            ctx.save();
            ctx.translate(velX, velY);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-6, -3);
            ctx.lineTo(-6, 3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(500, 500, 200);
        sunLight.castShadow = true;
        sunLight.shadow.camera.left = -200;
        sunLight.shadow.camera.right = 200;
        sunLight.shadow.camera.top = 200;
        sunLight.shadow.camera.bottom = -200;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 2000;
        this.scene.add(sunLight);
        
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(0, 100, 0);
        this.scene.add(pointLight);
    }

    createStarfield() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.5,
            transparent: true
        });
        
        const starsVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 5000;
            const y = (Math.random() - 0.5) * 5000;
            const z = (Math.random() - 0.5) * 5000;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
    }

    createGameObjects() {
        this.rocket = new Rocket(this.scene);
        
        const earthData = getPlanetByName('Earth');
        this.earth = new Planet(this.scene, {
            ...earthData,
            radius: 100,
            mass: 1000,
            position: new THREE.Vector3(0, 0, 0) // Position Earth at Y=0 for 2D mode compatibility
        });
        
        // Position rocket on Europe (lat: 55, lon: 10)
        this.positionRocketOnEurope();
        
        // Add Earth to edge indicators
        this.edgeIndicators.addPlanet(this.earth);
        
        this.setupLevel(this.currentLevel);
        
        // Initial camera setup
        this.updateInitialCamera();
    }

    positionRocketOnEurope() {
        // Position rocket on Earth's surface using the same orientation logic as landing
        this.earth.orientRocketOnSurface(this.rocket);
    }

    updateInitialCamera() {
        // Simple camera setup to see the rocket and Earth
        const rocketPos = this.rocket.mesh.position;
        
        // Position camera behind and above the rocket
        this.camera.position.set(rocketPos.x + 30, rocketPos.y + 20, rocketPos.z + 50);
        this.camera.lookAt(rocketPos);
    }

    setupLevel(level) {
        if (this.targetPlanet) {
            this.scene.remove(this.targetPlanet.mesh);
            if (this.targetPlanet.atmosphere) this.scene.remove(this.targetPlanet.atmosphere);
            if (this.targetPlanet.rings) this.scene.remove(this.targetPlanet.rings);
            if (this.targetPlanet.greatRedSpot) this.scene.remove(this.targetPlanet.greatRedSpot);
            if (this.targetPlanet.iceSurface) this.scene.remove(this.targetPlanet.iceSurface);
            this.edgeIndicators.removePlanet(this.targetPlanet.name);
        }
        
        if (this.asteroidField) {
            this.asteroidField.asteroids.forEach(asteroid => asteroid.destroy());
        }
        
        const targetData = getTargetForLevel(level);
        
        let position;
        if (targetData.parentPlanet) {
            const parentPlanet = getPlanetByName(targetData.parentPlanet);
            const parentDistance = parentPlanet.distanceFromSun;
            position = new THREE.Vector3(
                parentDistance + targetData.distanceFromParent,
                0, // Lock Y position to 0 for 2D mode compatibility
                parentDistance * 0.2
            );
        } else {
            const distance = targetData.distanceFromSun || (1500 + level * 500);
            position = new THREE.Vector3(
                distance * (Math.random() - 0.5),
                0, // Lock Y position to 0 for 2D mode compatibility
                distance * (Math.random() - 0.5)
            );
        }
        
        const planetOptions = {
            ...targetData,
            position: position
        };
        
        if (level >= 3 && level <= 10) {
            const asteroidDistance = position.clone().multiplyScalar(0.6);
            // Also lock asteroid field to same Y level
            asteroidDistance.y = 0;
            this.asteroidField = new AsteroidField(
                this.scene,
                asteroidDistance,
                400,
                20 + level * 3
            );
        }
        
        this.targetPlanet = new Planet(this.scene, planetOptions);
        this.landingZone = this.targetPlanet.generateLandingZone();
        
        // Add planets to edge indicators (Earth is added here, target planet will be added in setupLevel)
        this.edgeIndicators.addPlanet(this.targetPlanet);
    }

    updateCamera() {
        let cameraOffset;
        
        switch (this.gameState) {
            case 'launch':
                // Third-person trailing camera positioned behind and below the rocket
                // Since rocket points up (+Y), camera should be positioned back and down
                cameraOffset = new THREE.Vector3(0, -8, 25);
                break;
                
            case 'space':
                if (this.viewMode === '2d') {
                    // 2D space view - camera positioned above looking down
                    const distance = 80 + Math.min(this.rocket.getSpeed() * 2, 40);
                    cameraOffset = new THREE.Vector3(0, distance, 0);
                } else {
                    // 3D space view - dynamic distance based on speed
                    const distance = 40 + Math.min(this.rocket.getSpeed() * 3, 60);
                    cameraOffset = new THREE.Vector3(0, 5, distance);
                }
                break;
                
            case 'landing':
                // Close overhead view tilted forward for precision landing
                cameraOffset = new THREE.Vector3(0, 15, 15);
                break;
        }
        
        if (this.viewMode === '2d' && this.gameState === 'space') {
            // In 2D mode, position camera directly above rocket
            this.camera.position.set(this.rocket.position.x, this.rocket.position.y + cameraOffset.y, this.rocket.position.z);
            this.camera.lookAt(this.rocket.position);
        } else {
            // Apply rocket's rotation to camera offset for proper third-person perspective
            const rotatedOffset = cameraOffset.clone().applyQuaternion(this.rocket.mesh.quaternion);
            
            // Position camera relative to rocket
            this.camera.position.copy(this.rocket.position).add(rotatedOffset);
            
            // Camera should look at the rocket itself, not ahead of it
            this.camera.lookAt(this.rocket.position);
        }
    }

    updateLandingGearDeployment() {
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        const targetAltitude = this.targetPlanet.getAltitude(this.rocket.position);
        
        // Deploy landing gear when close to any planet (within 100 units altitude)
        const deploymentAltitude = 100;
        const shouldDeploy = earthAltitude < deploymentAltitude || targetAltitude < deploymentAltitude;
        
        if (shouldDeploy) {
            this.rocket.deployLandingGear();
        } else {
            this.rocket.retractLandingGear();
        }
    }

    updateRocketOrientation() {
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        const targetAltitude = this.targetPlanet.getAltitude(this.rocket.position);
        
        // Auto-orient rocket when very close to planet surface (within 20 units altitude)
        const orientationAltitude = 20;
        let closestPlanet = null;
        
        if (earthAltitude < orientationAltitude && earthAltitude < targetAltitude) {
            closestPlanet = this.earth;
        } else if (targetAltitude < orientationAltitude) {
            closestPlanet = this.targetPlanet;
        }
        
        if (closestPlanet && this.rocket.getSpeed() < 15) {
            // Gradually orient rocket to be upright relative to the closest planet
            const planetCenter = closestPlanet.mesh.position;
            const rocketPosition = this.rocket.position;
            
            // Calculate the up direction from planet center to rocket position
            const upDirection = rocketPosition.clone().sub(planetCenter).normalize();
            
            // Create target orientation (rocket pointing away from planet center)
            const targetPosition = rocketPosition.clone().add(upDirection.multiplyScalar(10));
            
            // Apply gradual orientation change
            const currentForward = new THREE.Vector3(0, 1, 0).applyQuaternion(this.rocket.mesh.quaternion);
            const desiredForward = upDirection.clone();
            
            // Interpolate between current and desired orientation
            const lerpFactor = 0.05; // Adjust this value to control orientation speed
            const newForward = currentForward.clone().lerp(desiredForward, lerpFactor);
            
            // Apply the new orientation
            this.rocket.mesh.lookAt(rocketPosition.clone().add(newForward.multiplyScalar(10)));
        }
    }

    updateHUD() {
        document.getElementById('score').textContent = Math.floor(this.score);
        document.getElementById('planetsVisited').textContent = this.planetsVisited;
        document.getElementById('fuelText').textContent = Math.floor(this.rocket.getFuelPercentage()) + '%';
        document.getElementById('fuelBar').style.width = this.rocket.getFuelPercentage() + '%';
        document.getElementById('velocity').textContent = Math.floor(this.rocket.getSpeed());
        
        const altitude = Math.min(
            this.earth.getAltitude(this.rocket.position),
            this.targetPlanet.getAltitude(this.rocket.position)
        );
        document.getElementById('altitude').textContent = Math.floor(Math.max(0, altitude));
        
        const targetInfo = document.getElementById('targetInfo');
        if (targetInfo) {
            targetInfo.innerHTML = `
                <strong>Target: ${this.targetPlanet.name}</strong><br>
                ${this.targetPlanet.description}<br>
                Gravity: ${this.targetPlanet.gravity}g<br>
                Difficulty: ${this.targetPlanet.difficulty}/10<br>
                <strong>View Mode: ${this.viewMode.toUpperCase()}</strong>
            `;
        }
    }

    checkGameState() {
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        const targetAltitude = this.targetPlanet.getAltitude(this.rocket.position);
        
        if (this.gameState === 'launch' && earthAltitude > 200) {
            this.gameState = 'space';
        }
        
        if (this.gameState === 'space' && targetAltitude < 200) {
            this.gameState = 'landing';
        }
        
        // Update view mode based on proximity to planets
        this.updateViewMode();
        
        const landingResult = this.targetPlanet.checkLanding(this.rocket);
        if (landingResult === 'success') {
            this.onLandingSuccess();
        } else if (landingResult === 'crash') {
            this.onGameOver('Crashed! Landing speed too high.');
        }
        
        if (this.rocket.fuel <= 0 && this.rocket.getSpeed() < 0.1 && earthAltitude > 10) {
            this.onGameOver('Out of fuel!');
        }
    }

    updateViewMode() {
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        const targetAltitude = this.targetPlanet.getAltitude(this.rocket.position);
        
        // Check if we're close to any planet
        const nearEarth = earthAltitude < this.planetaryProximityThreshold;
        const nearTargetPlanet = targetAltitude < this.planetaryProximityThreshold;
        
        if (nearEarth || nearTargetPlanet) {
            this.viewMode = '3d';
        } else if (this.gameState === 'space') {
            this.viewMode = '2d';
        }
    }

    onLandingSuccess() {
        this.planetsVisited++;
        this.score += 1000 * this.currentLevel;
        this.score += this.rocket.fuel * 10;
        
        setTimeout(() => {
            this.currentLevel++;
            this.rocket.reset();
            this.positionRocketOnEurope();
            this.setupLevel(this.currentLevel);
            this.gameState = 'launch';
        }, 3000);
    }

    onGameOver(message) {
        this.gameState = 'gameOver';
        document.getElementById('gameOverText').textContent = message;
        document.getElementById('gameOver').style.display = 'block';
    }

    update() {
        const deltaTime = Math.min(this.clock.getDelta(), 0.016); // Cap at 60fps
        
        if (this.gameState === 'gameOver') return;
        
        const movement = this.inputHandler.getMovementInput();
        
        if (movement.boost) {
            this.rocket.applyMainThrust(deltaTime, this.viewMode);
        }
        
        // RCS controls only work when rocket has some velocity (for fine adjustments)
        if (this.rocket.getSpeed() > 0.5) {
            const rcsDirection = new THREE.Vector3();
            if (movement.forward) rcsDirection.z -= 0.15;
            if (movement.backward) rcsDirection.z += 0.15;
            if (movement.left) rcsDirection.x -= 0.15;
            if (movement.right) rcsDirection.x += 0.15;
            if (movement.decelerate) {
                const velocity = this.rocket.velocity.clone().normalize().negate();
                rcsDirection.add(velocity.multiplyScalar(0.3));
            }
            
            if (rcsDirection.length() > 0) {
                rcsDirection.normalize();
                this.rocket.applyRCSThrust(rcsDirection, deltaTime, this.viewMode);
            }
        }
        
        const earthGravity = this.physics.applyGravity(this.rocket, this.earth);
        const targetGravity = this.physics.applyGravity(this.rocket, this.targetPlanet);
        const totalGravity = earthGravity.add(targetGravity);
        
        // Check if rocket is near any planet (within atmospheric range)
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        const targetAltitude = this.targetPlanet.getAltitude(this.rocket.position);
        const atmosphericRange = 300; // Distance where atmospheric drag applies
        const nearPlanet = earthAltitude < atmosphericRange || targetAltitude < atmosphericRange;
        
        this.rocket.update(deltaTime, totalGravity, nearPlanet, this.viewMode);
        this.earth.update(deltaTime);
        this.targetPlanet.update(deltaTime);
        
        // Automatic landing gear deployment based on proximity to planets
        this.updateLandingGearDeployment();
        
        // Auto-orient rocket when close to planet surface
        this.updateRocketOrientation();
        
        if (this.asteroidField) {
            this.asteroidField.update(deltaTime);
            const collision = this.asteroidField.checkCollisions(this.rocket, 5);
            if (collision) {
                this.onGameOver('Collision with asteroid!');
            }
        }
        
        this.updateCamera();
        this.updateHUD();
        this.updateMiniMap();
        this.edgeIndicators.update(this.camera, [this.earth, this.targetPlanet]);
        this.checkGameState();
        
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
    }
}