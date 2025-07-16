import * as THREE from 'three';

export class Physics {
    constructor() {
        // Scaled down physics for gameplay
        this.G = 0.1;
        this.earthMass = 1000;
        this.earthRadius = 100;
        this.moonMass = 100;
        this.moonRadius = 50;
        this.marsMass = 500;
        this.marsRadius = 70;
    }

    calculateGravityForce(mass1, mass2, distance) {
        if (distance === 0) return new THREE.Vector3(0, 0, 0);
        return (this.G * mass1 * mass2) / (distance * distance);
    }

    applyGravity(object, planet) {
        const direction = new THREE.Vector3()
            .subVectors(planet.position, object.position)
            .normalize();
        
        const distance = object.position.distanceTo(planet.position);
        const force = this.calculateGravityForce(object.mass, planet.mass, distance);
        
        return direction.multiplyScalar(force / object.mass);
    }

    checkCollision(object1, object2, radius1, radius2) {
        const distance = object1.position.distanceTo(object2.position);
        return distance < (radius1 + radius2);
    }

    updateVelocity(object, acceleration, deltaTime) {
        object.velocity.x += acceleration.x * deltaTime;
        object.velocity.y += acceleration.y * deltaTime;
        object.velocity.z += acceleration.z * deltaTime;
    }

    updatePosition(object, deltaTime) {
        object.position.x += object.velocity.x * deltaTime;
        object.position.y += object.velocity.y * deltaTime;
        object.position.z += object.velocity.z * deltaTime;
    }

    calculateOrbitalVelocity(centralMass, radius) {
        return Math.sqrt((this.G * centralMass) / radius);
    }

    calculateEscapeVelocity(mass, radius) {
        return Math.sqrt((2 * this.G * mass) / radius);
    }
}