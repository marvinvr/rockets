import * as THREE from 'three';
import { Physics } from './utils/Physics.js';
import { InputHandler } from './utils/InputHandler.js';
import { EdgeIndicators } from './utils/EdgeIndicators.js';
import { Rocket } from './objects/Rocket.js';
import { Planet } from './objects/Planet.js';
import { AsteroidField } from './objects/Asteroid.js';
import { getPlanetByName, SOLAR_SYSTEM } from './data/SolarSystem.js';

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
        this.visitedPlanets = new Set();
        
        // Add 2D/3D mode switching
        this.viewMode = '3d'; // '2d' or '3d'
        this.planetaryProximityThreshold = 300; // Distance to switch to 3D mode
        
        this.cameraOffset = new THREE.Vector3(0, 10, 20);
        this.cameraTarget = new THREE.Vector3();
        this.cameraPosition = new THREE.Vector3();
        this.cameraLerpSpeed = 0.1;
        
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
        
        // Draw all planets in the solar system
        if (this.planets) {
            this.planets.forEach(planet => {
                const planetPos = planet.mesh.position;
                const planetX = this.miniMapCenter.x + planetPos.x * this.miniMapScale;
                const planetY = this.miniMapCenter.y + planetPos.z * this.miniMapScale;
                
                // Color based on planet
                const colors = {
                    'Mercury': '#8C7853',
                    'Venus': '#FFC649',
                    'Mars': '#cc4433',
                    'Jupiter': '#D8CA9D',
                    'Saturn': '#FAD5A5',
                    'Uranus': '#4FD0E7',
                    'Neptune': '#4169E1',
                    'Moon': '#aaaaaa',
                    'Phobos': '#8B4513',
                    'Deimos': '#696969',
                    'Europa': '#E6F3FF',
                    'Io': '#FFFF80',
                    'Titan': '#FFA500'
                };
                
                ctx.fillStyle = colors[planet.name] || '#888888';
                
                // Size based on planet radius
                const size = Math.max(2, planet.radius * 0.05);
                ctx.beginPath();
                ctx.arc(planetX, planetY, size, 0, 2 * Math.PI);
                ctx.fill();
                
                // Highlight visited planets
                if (this.visitedPlanets.has(planet.name)) {
                    ctx.strokeStyle = '#00ff00';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(planetX, planetY, size + 2, 0, 2 * Math.PI);
                    ctx.stroke();
                }
                
                // Label planets
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(planet.name, planetX, planetY - size - 2);
            });
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
        
        this.createAllPlanets();
        
        // Initial camera setup
        this.updateInitialCamera();
    }

    positionRocketOnEurope() {
        // Position rocket on Earth's surface using the same orientation logic as landing
        this.earth.orientRocketOnSurface(this.rocket);
    }

    updateInitialCamera() {
        // Initialize camera position and target for smooth interpolation
        const rocketPos = this.rocket.mesh.position;
        
        // Set initial camera position behind and above the rocket
        this.cameraPosition.set(rocketPos.x + 30, rocketPos.y + 20, rocketPos.z + 50);
        this.cameraTarget.copy(rocketPos);
        
        // Set camera to initial position
        this.camera.position.copy(this.cameraPosition);
        this.camera.lookAt(this.cameraTarget);
    }

    createAllPlanets() {
        this.planets = [];
        
        // Create all planets from the solar system data
        SOLAR_SYSTEM.planets.forEach(planetData => {
            if (planetData.name === 'Earth') return; // Earth is already created
            
            // Calculate orbital position
            const angle = Math.random() * Math.PI * 2; // Random starting position
            const distance = planetData.distanceFromSun;
            const position = new THREE.Vector3(
                Math.cos(angle) * distance,
                0, // Lock Y position to 0 for 2D mode compatibility
                Math.sin(angle) * distance
            );
            
            const planetOptions = {
                ...planetData,
                position: position
            };
            
            const planet = new Planet(this.scene, planetOptions);
            this.planets.push(planet);
            
            // Add planet to edge indicators
            this.edgeIndicators.addPlanet(planet);
        });
        
        // Create moons
        SOLAR_SYSTEM.moons.forEach(moonData => {
            const parentPlanet = this.planets.find(p => p.name === moonData.parentPlanet) || 
                                 (moonData.parentPlanet === 'Earth' ? this.earth : null);
            
            if (parentPlanet) {
                const moonAngle = Math.random() * Math.PI * 2;
                const moonDistance = moonData.distanceFromParent;
                const moonPosition = parentPlanet.mesh.position.clone().add(
                    new THREE.Vector3(
                        Math.cos(moonAngle) * moonDistance,
                        0,
                        Math.sin(moonAngle) * moonDistance
                    )
                );
                
                const moonOptions = {
                    ...moonData,
                    position: moonPosition
                };
                
                const moon = new Planet(this.scene, moonOptions);
                this.planets.push(moon);
                this.edgeIndicators.addPlanet(moon);
            }
        });
        
        // Create asteroid belts
        this.asteroidFields = [];
        SOLAR_SYSTEM.asteroidBelts.forEach(beltData => {
            const asteroidField = new AsteroidField(
                this.scene,
                new THREE.Vector3(0, 0, 0),
                beltData.outerRadius - beltData.innerRadius,
                beltData.asteroidCount
            );
            
            // Position asteroids in a belt
            asteroidField.asteroids.forEach(asteroid => {
                const angle = Math.random() * Math.PI * 2;
                const distance = beltData.innerRadius + Math.random() * (beltData.outerRadius - beltData.innerRadius);
                asteroid.mesh.position.set(
                    Math.cos(angle) * distance,
                    0,
                    Math.sin(angle) * distance
                );
            });
            
            this.asteroidFields.push(asteroidField);
        });
    }

    updateCamera() {
        // Always use consistent up vector to prevent flipping
        this.camera.up.set(0, 1, 0);
        
        // Calculate desired camera position and target
        let desiredPosition = new THREE.Vector3();
        let desiredTarget = this.rocket.position.clone();
        
        if (this.viewMode === '2d') {
            // 2D space view - camera positioned above looking down
            const distance = 80 + Math.min(this.rocket.getSpeed() * 2, 40);
            desiredPosition.set(
                this.rocket.position.x,
                this.rocket.position.y + distance,
                this.rocket.position.z
            );
        } else {
            // 3D mode - calculate position based on game state
            let cameraOffset;
            let useRocketRotation = true;
            
            switch (this.gameState) {
                case 'launch':
                    // For launch, use a fixed world-space offset to avoid disorientation
                    cameraOffset = new THREE.Vector3(30, 20, 50);
                    useRocketRotation = false; // Don't rotate with rocket during launch
                    break;
                    
                case 'space':
                    // 3D space view - dynamic distance based on speed
                    const distance = 40 + Math.min(this.rocket.getSpeed() * 3, 60);
                    cameraOffset = new THREE.Vector3(0, 5, distance);
                    useRocketRotation = true; // Follow rocket rotation in space
                    break;
                    
                case 'landing':
                    // Close overhead view tilted forward for precision landing
                    cameraOffset = new THREE.Vector3(0, 15, 15);
                    useRocketRotation = true; // Follow rocket rotation for landing
                    break;
            }
            
            // Apply rotation only when appropriate
            if (useRocketRotation) {
                const rotatedOffset = cameraOffset.clone().applyQuaternion(this.rocket.mesh.quaternion);
                desiredPosition.copy(this.rocket.position).add(rotatedOffset);
            } else {
                // Use world-space positioning for launch
                desiredPosition.copy(this.rocket.position).add(cameraOffset);
            }
        }
        
        // Smooth camera movement using interpolation
        this.cameraPosition.lerp(desiredPosition, this.cameraLerpSpeed);
        this.cameraTarget.lerp(desiredTarget, this.cameraLerpSpeed);
        
        // Apply smoothed position and look at target
        this.camera.position.copy(this.cameraPosition);
        this.camera.lookAt(this.cameraTarget);
    }

    updateLandingGearDeployment() {
        const deploymentAltitude = 100;
        let shouldDeploy = false;
        
        // Check Earth altitude
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        if (earthAltitude < deploymentAltitude) {
            shouldDeploy = true;
        }
        
        // Check all other planets
        if (this.planets) {
            this.planets.forEach(planet => {
                const altitude = planet.getAltitude(this.rocket.position);
                if (altitude < deploymentAltitude) {
                    shouldDeploy = true;
                }
            });
        }
        
        if (shouldDeploy) {
            this.rocket.deployLandingGear();
        } else {
            this.rocket.retractLandingGear();
        }
    }

    updateRocketOrientation() {
        const orientationAltitude = 20;
        let closestPlanet = null;
        let closestDistance = Infinity;
        
        // Check Earth
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        if (earthAltitude < orientationAltitude && earthAltitude < closestDistance) {
            closestPlanet = this.earth;
            closestDistance = earthAltitude;
        }
        
        // Check all other planets
        if (this.planets) {
            this.planets.forEach(planet => {
                const altitude = planet.getAltitude(this.rocket.position);
                if (altitude < orientationAltitude && altitude < closestDistance) {
                    closestPlanet = planet;
                    closestDistance = altitude;
                }
            });
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
        
        // Find the closest planet for altitude display
        let closestAltitude = this.earth.getAltitude(this.rocket.position);
        let closestPlanet = this.earth;
        
        if (this.planets) {
            this.planets.forEach(planet => {
                const altitude = planet.getAltitude(this.rocket.position);
                if (altitude < closestAltitude) {
                    closestAltitude = altitude;
                    closestPlanet = planet;
                }
            });
        }
        
        document.getElementById('altitude').textContent = Math.floor(Math.max(0, closestAltitude));
        
        const targetInfo = document.getElementById('targetInfo');
        if (targetInfo) {
            targetInfo.innerHTML = `
                <strong>Closest: ${closestPlanet.name}</strong><br>
                ${closestPlanet.description}<br>
                Gravity: ${closestPlanet.gravity}g<br>
                Difficulty: ${closestPlanet.difficulty}/10<br>
                <strong>View Mode: ${this.viewMode.toUpperCase()}</strong>
            `;
        }
    }

    checkGameState() {
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        
        if (this.gameState === 'launch' && earthAltitude > 200) {
            this.gameState = 'space';
        }
        
        // Check if we're approaching any planet for landing
        let closestPlanetAltitude = Infinity;
        let closestPlanet = null;
        
        if (this.planets) {
            this.planets.forEach(planet => {
                const altitude = planet.getAltitude(this.rocket.position);
                if (altitude < closestPlanetAltitude) {
                    closestPlanetAltitude = altitude;
                    closestPlanet = planet;
                }
            });
        }
        
        if (this.gameState === 'space' && closestPlanetAltitude < 200) {
            this.gameState = 'landing';
        }
        
        // Update view mode based on proximity to planets
        this.updateViewMode();
        
        // Check landing on Earth
        const earthLandingResult = this.earth.checkLanding(this.rocket);
        if (earthLandingResult === 'success') {
            this.onLandingSuccess(this.earth);
        } else if (earthLandingResult === 'crash') {
            this.onGameOver('Crashed! Landing speed too high.');
        }
        
        // Check landing on other planets
        if (this.planets) {
            this.planets.forEach(planet => {
                const landingResult = planet.checkLanding(this.rocket);
                if (landingResult === 'success') {
                    this.onLandingSuccess(planet);
                } else if (landingResult === 'crash') {
                    this.onGameOver('Crashed! Landing speed too high.');
                }
            });
        }
        
        if (this.rocket.fuel <= 0 && this.rocket.getSpeed() < 0.1 && earthAltitude > 10) {
            this.onGameOver('Out of fuel!');
        }
    }

    updateViewMode() {
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        let nearAnyPlanet = earthAltitude < this.planetaryProximityThreshold;
        let closestAltitude = earthAltitude;
        
        // Check if we're close to any planet
        if (this.planets && !nearAnyPlanet) {
            this.planets.forEach(planet => {
                const altitude = planet.getAltitude(this.rocket.position);
                if (altitude < closestAltitude) {
                    closestAltitude = altitude;
                }
                if (altitude < this.planetaryProximityThreshold) {
                    nearAnyPlanet = true;
                }
            });
        }
        
        // Add hysteresis to prevent rapid switching
        const switchThreshold = this.planetaryProximityThreshold;
        const returnThreshold = this.planetaryProximityThreshold * 1.5; // 50% higher threshold for switching back
        
        if (this.viewMode === '2d' && closestAltitude < switchThreshold) {
            this.viewMode = '3d';
        } else if (this.viewMode === '3d' && closestAltitude > returnThreshold) {
            this.viewMode = '2d';
        }
        
        // Adjust camera lerp speed based on mode transitions
        this.cameraLerpSpeed = this.viewMode === '3d' ? 0.08 : 0.05;
    }

    onLandingSuccess(planet) {
        if (!this.visitedPlanets.has(planet.name)) {
            this.planetsVisited++;
            this.visitedPlanets.add(planet.name);
            this.score += 1000 * planet.difficulty;
            this.score += this.rocket.fuel * 10;
            
            setTimeout(() => {
                this.rocket.reset();
                this.positionRocketOnEurope();
                this.gameState = 'launch';
            }, 3000);
        }
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
        
        // Apply gravity from all planets
        let totalGravity = this.physics.applyGravity(this.rocket, this.earth);
        
        if (this.planets) {
            this.planets.forEach(planet => {
                const gravity = this.physics.applyGravity(this.rocket, planet);
                totalGravity.add(gravity);
            });
        }
        
        // Check if rocket is near any planet (within atmospheric range)
        const earthAltitude = this.earth.getAltitude(this.rocket.position);
        const atmosphericRange = 300; // Distance where atmospheric drag applies
        let nearPlanet = earthAltitude < atmosphericRange;
        
        if (this.planets && !nearPlanet) {
            this.planets.forEach(planet => {
                const altitude = planet.getAltitude(this.rocket.position);
                if (altitude < atmosphericRange) {
                    nearPlanet = true;
                }
            });
        }
        
        this.rocket.update(deltaTime, totalGravity, nearPlanet, this.viewMode);
        this.earth.update(deltaTime);
        
        if (this.planets) {
            this.planets.forEach(planet => {
                planet.update(deltaTime);
            });
        }
        
        // Automatic landing gear deployment based on proximity to planets
        this.updateLandingGearDeployment();
        
        // Auto-orient rocket when close to planet surface
        this.updateRocketOrientation();
        
        if (this.asteroidFields) {
            this.asteroidFields.forEach(asteroidField => {
                asteroidField.update(deltaTime);
                const collision = asteroidField.checkCollisions(this.rocket, 5);
                if (collision) {
                    this.onGameOver('Collision with asteroid!');
                }
            });
        }
        
        this.updateCamera();
        this.updateHUD();
        this.updateMiniMap();
        
        // Update edge indicators with all planets
        const allPlanets = [this.earth, ...(this.planets || [])];
        this.edgeIndicators.update(this.camera, allPlanets);
        
        this.checkGameState();
        
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        this.lastTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        this.animate();
    }

    animate(currentTime = 0) {
        requestAnimationFrame((time) => this.animate(time));
        
        // Cap to 60 FPS
        if (currentTime - this.lastTime >= this.frameInterval) {
            this.update();
            this.lastTime = currentTime;
        }
    }
}