### Game Overview
This 3D browser-based rocket exploration game, powered by Three.js, lets players pilot a customizable spacecraft. Launch from Earth's surface, navigate vast space, and attempt precise landings on procedurally generated planets such as Mars or the Moon. Core challenges revolve around physics simulation: fuel management for thrusts and maneuvers, trajectory calculations to evade asteroids, and controlled descents adapting to different gravitational forces.

### Visual Perspectives
- **Launch Phase**: Third-person trailing camera positioned at a 45-degree downward angle, capturing ignited exhaust flames as Earth's curved blue horizon and clouds recede into a darkening, star-filled void.
- **Space Navigation**: 360-degree orbital panning around the spacecraft via mouse control, set against a twinkling starry backdrop with distant glowing planets and navigable gray asteroid clusters to dodge.
- **Landing Phase**: Close third-person overhead view tilted forward at 30 degrees for precision, showing the rocket's shadow enlarging on cratered surfaces, dust particles kicking up, and real-time velocity indicators on the HUD as terrain approaches.
- **Success View**: Wide-angle static shot of the landed rocket in alien landscapes, illuminated by celebratory flares.

### Gameplay Mechanics
- Manage limited fuel resources for all actions: upward boosts during launch, directional adjustments in space, and deceleration for safe landings.
- Avoid obstacles like asteroid fields through calculated paths; collisions or fuel depletion lead to failure states.
- Procedurally generated planets increase difficulty across levels, with varying gravity, distances, and environmental hazards.

### Controls
- W/A/S/D: Directional thrust (forward, left, backward, right).
- Spacebar: Main upward boost for launches and ascents.
- Perspective: 3rd person view of the rocket.
- Shift: Deceleration for controlled descents and landings.

### Scoring and Replayability
- Score tracks the number of planets visited and total fuel consumed in tons.
- Escalating levels unlock new planets and upgrades, promoting multiple playthroughs in a seamless, immersive loop.

### Code Structure
Keep the project simple by organizing into folders for separation of concerns: core logic in one place, assets elsewhere, and utilities grouped. This aids maintenance without overcomplicating.

- **src/**: Main source code folder for JavaScript files. Separate game objects (e.g., rocket and planet classes), utilities (e.g., physics and input handlers), and the entry point (e.g., main setup and loop).
- **lib/**: External libraries, such as three.js and cannon.js files (minified versions for browser use).
- **Root**: Top-level files like index.html (for canvas embedding) and package.json.


## Development Practices
- NEVER try to do like bun run dev or whatever to test it. The developer will do that himself and give you feedback.