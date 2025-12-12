/**
 * LET DOWN - Radiohead Lyric Visualizer
 * An immersive 3D experience capturing devastation, escape, and the desire to grow wings
 */

// Using global THREE object from classic script tags
// Post-processing classes are available as THREE.EffectComposer, THREE.RenderPass, etc.

// ========================================
// RGB Shift Shader (Chromatic Aberration)
// ========================================
const RGBShiftShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'amount': { value: 0.0 },
        'angle': { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        uniform float angle;
        varying vec2 vUv;
        
        void main() {
            vec2 offset = amount * vec2(cos(angle), sin(angle));
            vec4 cr = texture2D(tDiffuse, vUv + offset);
            vec4 cga = texture2D(tDiffuse, vUv);
            vec4 cb = texture2D(tDiffuse, vUv - offset);
            gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
        }
    `
};

// ========================================
// Configuration
// ========================================
const CONFIG = {
    particles: {
        count: 15000,
        spread: 200,
        depth: 400,
        baseSize: 2.5,
        colors: {
            primary: 0x8090a0,    // Cool grey
            secondary: 0x4060a0,  // Deep blue
            accent: 0xffffff      // White
        }
    },
    states: {
        verse: {
            speed: 0.3,
            particleSize: 2.5,
            bloomStrength: 0.4,
            bloomRadius: 0.3,
            rgbShift: 0.0
        },
        buildup: {
            speed: 0.8,
            particleSize: 2.0,
            bloomStrength: 0.6,
            bloomRadius: 0.4,
            rgbShift: 0.001
        },
        climax: {
            speed: 4.0,
            particleSize: 1.0,
            bloomStrength: 1.5,
            bloomRadius: 0.6,
            rgbShift: 0.003
        },
        hysterical: {
            speed: 8.0,
            particleSize: 0.5,
            bloomStrength: 2.5,
            bloomRadius: 1.0,
            rgbShift: 0.015
        }
    }
};

// ========================================
// Global State
// ========================================
let scene, camera, renderer, composer;
let particles, particleGeometry, particleMaterial;
let bloomPass, rgbShiftPass;
let clock, currentState, targetState;
let isRunning = false;

// Lyric sequence - using placeholder text that evokes the emotional journey
// The actual lyrics would need to be added by the user
const LYRIC_SEQUENCE = [
    { time: 0, text: "", action: "start" },
    { time: 2, text: "you know", action: "show", state: "verse" },
    { time: 4, text: "where you are with", action: "show" },
    { time: 7, text: "...", action: "show", state: "buildup" },
    { time: 10, text: "floor collapses", action: "collapse" },
    { time: 12, text: "floating", action: "show" },
    { time: 15, text: "bouncing back", action: "show" },
    { time: 18, text: "and one day", action: "show", state: "climax" },
    { time: 21, text: "I am gonna grow wings", action: "wings" },
    { time: 26, text: "a chemical reaction", action: "noise" },
    { time: 30, text: "hysterical and useless", action: "hysterical", state: "hysterical" },
    { time: 36, text: "...", action: "show" },
    { time: 40, text: "", action: "fadeout" }
];

// ========================================
// Initialization
// ========================================
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.002);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Post-processing
    setupPostProcessing();

    // Particles
    createParticles();

    // Clock
    clock = new THREE.Clock();

    // Initial state
    currentState = { ...CONFIG.states.verse };
    targetState = { ...CONFIG.states.verse };

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.getElementById('start-overlay').addEventListener('click', startExperience);

    // Start render loop (but paused)
    animate();
}

// ========================================
// Post-Processing Setup
// ========================================
function setupPostProcessing() {
    composer = new THREE.EffectComposer(renderer);

    // Render pass
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom pass - dreamy, teary-eyed glow
    bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        CONFIG.states.verse.bloomStrength,
        CONFIG.states.verse.bloomRadius,
        0.85
    );
    composer.addPass(bloomPass);

    // RGB Shift pass - chromatic aberration for glitch
    rgbShiftPass = new THREE.ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms['amount'].value = 0;
    rgbShiftPass.uniforms['angle'].value = 0;
    composer.addPass(rgbShiftPass);
}

// ========================================
// Particle System
// ========================================
function createParticles() {
    const { count, spread, depth } = CONFIG.particles;

    // Geometry
    particleGeometry = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities = new Float32Array(count);

    const color1 = new THREE.Color(CONFIG.particles.colors.primary);
    const color2 = new THREE.Color(CONFIG.particles.colors.secondary);
    const color3 = new THREE.Color(CONFIG.particles.colors.accent);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // Cylindrical distribution around camera
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.random() * spread;

        positions[i3] = Math.cos(theta) * radius;
        positions[i3 + 1] = Math.sin(theta) * radius;
        positions[i3 + 2] = Math.random() * depth - depth / 2;

        // Color variation
        const colorChoice = Math.random();
        let color;
        if (colorChoice < 0.6) {
            color = color1;
        } else if (colorChoice < 0.9) {
            color = color2;
        } else {
            color = color3;
        }

        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;

        // Size variation
        sizes[i] = Math.random() * 2 + 1;

        // Velocity variation
        velocities[i] = Math.random() * 0.5 + 0.75;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.userData.velocities = velocities;

    // Custom shader material for particles
    particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uSize: { value: CONFIG.particles.baseSize },
            uSpeed: { value: CONFIG.states.verse.speed },
            uStretch: { value: 1.0 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            uniform float uSize;
            uniform float uStretch;
            varying vec3 vColor;
            varying float vDepth;
            
            void main() {
                vColor = color;
                
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vDepth = -mvPosition.z;
                
                // Size attenuation based on depth
                float sizeAtten = 300.0 / -mvPosition.z;
                gl_PointSize = size * uSize * sizeAtten;
                
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vDepth;
            
            void main() {
                // Circular particle shape
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                if (dist > 0.5) discard;
                
                // Soft edges
                float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                
                // Glow based on depth (closer = brighter)
                float glow = clamp(50.0 / vDepth, 0.3, 1.0);
                
                gl_FragColor = vec4(vColor * glow, alpha * glow);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

// ========================================
// Particle Animation
// ========================================
function updateParticles(deltaTime) {
    const positions = particleGeometry.attributes.position.array;
    const velocities = particleGeometry.userData.velocities;
    const { depth } = CONFIG.particles;

    const speed = currentState.speed;

    for (let i = 0; i < CONFIG.particles.count; i++) {
        const i3 = i * 3;

        // Move particles towards camera
        positions[i3 + 2] += speed * velocities[i] * deltaTime * 60;

        // Reset particles that pass camera
        if (positions[i3 + 2] > camera.position.z + 10) {
            positions[i3 + 2] = -depth / 2;

            // Randomize position slightly
            const theta = Math.random() * Math.PI * 2;
            const radius = Math.random() * CONFIG.particles.spread;
            positions[i3] = Math.cos(theta) * radius;
            positions[i3 + 1] = Math.sin(theta) * radius;
        }
    }

    particleGeometry.attributes.position.needsUpdate = true;

    // Update uniforms
    particleMaterial.uniforms.uSize.value = currentState.particleSize;
}

// ========================================
// State Interpolation
// ========================================
function updateState(deltaTime) {
    const lerpFactor = 1 - Math.pow(0.1, deltaTime);

    currentState.speed = THREE.MathUtils.lerp(currentState.speed, targetState.speed, lerpFactor);
    currentState.particleSize = THREE.MathUtils.lerp(currentState.particleSize, targetState.particleSize, lerpFactor);
    currentState.bloomStrength = THREE.MathUtils.lerp(currentState.bloomStrength, targetState.bloomStrength, lerpFactor);
    currentState.bloomRadius = THREE.MathUtils.lerp(currentState.bloomRadius, targetState.bloomRadius, lerpFactor);
    currentState.rgbShift = THREE.MathUtils.lerp(currentState.rgbShift, targetState.rgbShift, lerpFactor);

    // Apply to post-processing
    bloomPass.strength = currentState.bloomStrength;
    bloomPass.radius = currentState.bloomRadius;
    rgbShiftPass.uniforms['amount'].value = currentState.rgbShift;
}

// ========================================
// Camera Effects
// ========================================
function shakeCamera(intensity = 0.1, duration = 0.5) {
    const originalPosition = { x: camera.position.x, y: camera.position.y };
    const originalRotation = { x: camera.rotation.x, z: camera.rotation.z };

    gsap.to({}, {
        duration: duration,
        onUpdate: function () {
            const progress = this.progress();
            const decay = 1 - progress;

            camera.position.x = originalPosition.x + (Math.random() - 0.5) * intensity * decay;
            camera.position.y = originalPosition.y + (Math.random() - 0.5) * intensity * decay;
            camera.rotation.z = originalRotation.z + (Math.random() - 0.5) * intensity * 0.1 * decay;
        },
        onComplete: () => {
            camera.position.x = originalPosition.x;
            camera.position.y = originalPosition.y;
            camera.rotation.z = originalRotation.z;
        }
    });
}

function dropCamera() {
    gsap.to(camera.position, {
        y: camera.position.y - 3,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
            shakeCamera(0.3, 0.8);
            gsap.to(camera.position, {
                y: 0,
                duration: 2,
                ease: "elastic.out(1, 0.5)"
            });
        }
    });
}

// ========================================
// Lyric Display
// ========================================
const lyricElement = document.getElementById('lyric-text');
const flashOverlay = document.getElementById('flash-overlay');

function showLyric(text, options = {}) {
    lyricElement.textContent = text;
    lyricElement.className = 'visible';

    if (options.jitter) {
        lyricElement.classList.add('jitter');
    }

    if (options.intense) {
        lyricElement.classList.add('intense');
    }

    if (options.glitch) {
        lyricElement.classList.add('glitch-container');
        lyricElement.setAttribute('data-text', text);
    }
}

function hideLyric() {
    lyricElement.className = '';
    lyricElement.textContent = '';
}

function shatterLyric() {
    lyricElement.classList.add('shatter');
    setTimeout(() => {
        hideLyric();
    }, 500);
}

function flashScreen(intensity = 0.8, duration = 0.5) {
    gsap.to(flashOverlay, {
        opacity: intensity,
        duration: duration * 0.3,
        ease: "power2.in",
        onComplete: () => {
            gsap.to(flashOverlay, {
                opacity: 0,
                duration: duration * 0.7,
                ease: "power2.out"
            });
        }
    });
}

function wingsEffect() {
    // Extreme bloom burst
    gsap.to(targetState, {
        bloomStrength: 4.0,
        duration: 0.5,
        ease: "power2.in",
        onComplete: () => {
            flashScreen(0.9, 1.5);
            gsap.to(targetState, {
                bloomStrength: CONFIG.states.climax.bloomStrength,
                duration: 2,
                ease: "power2.out"
            });
        }
    });

    showLyric("I am gonna grow wings", { intense: true });
}

function hystericalEffect() {
    // Maximum chaos
    targetState = { ...CONFIG.states.hysterical };

    showLyric("hysterical and useless", { glitch: true, intense: true });

    // Oscillating RGB shift
    gsap.to(rgbShiftPass.uniforms['angle'], {
        value: Math.PI * 4,
        duration: 6,
        ease: "none"
    });

    // Intense shake
    shakeCamera(0.5, 6);
}

// ========================================
// Timeline Execution
// ========================================
function executeLyricAction(lyric) {
    const { text, action, state } = lyric;

    // Update state if specified
    if (state && CONFIG.states[state]) {
        targetState = { ...CONFIG.states[state] };
    }

    switch (action) {
        case 'start':
            hideLyric();
            break;

        case 'show':
            showLyric(text, { jitter: true });
            break;

        case 'collapse':
            showLyric(text, { jitter: true, intense: true });
            dropCamera();
            setTimeout(shatterLyric, 800);
            break;

        case 'wings':
            wingsEffect();
            break;

        case 'noise':
            showLyric(text, { jitter: true });
            shakeCamera(0.2, 4);
            break;

        case 'hysterical':
            hystericalEffect();
            break;

        case 'fadeout':
            hideLyric();
            gsap.to(targetState, {
                speed: 0.1,
                bloomStrength: 0.2,
                rgbShift: 0,
                duration: 5
            });
            break;
    }
}

// ========================================
// Experience Start
// ========================================
function startExperience() {
    if (isRunning) return;
    isRunning = true;

    // Hide start overlay
    document.getElementById('start-overlay').classList.add('hidden');

    // Reset clock
    clock.start();

    // Schedule all lyrics
    LYRIC_SEQUENCE.forEach(lyric => {
        setTimeout(() => {
            executeLyricAction(lyric);
        }, lyric.time * 1000);
    });
}

// ========================================
// Animation Loop
// ========================================
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = Math.min(clock.getDelta(), 0.1);

    if (isRunning) {
        updateParticles(deltaTime);
        updateState(deltaTime);
    }

    composer.render();
}

// ========================================
// Resize Handler
// ========================================
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
}

// ========================================
// Initialize
// ========================================
init();
