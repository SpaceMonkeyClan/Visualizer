import { BeatDetector } from './audioAnalysis.js';
import { createParticleField } from './particles.js';
import { setupPostProcessing } from './postprocessing.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const baseBgColor = 0x05050c;
scene.background = new THREE.Color(baseBgColor);
scene.fog = new THREE.FogExp2(baseBgColor, 0.035);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 8;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
container.appendChild(renderer.domElement);

const { composer, bloomPass, chromaticAberrationPass } = setupPostProcessing(renderer, scene, camera);

// --- Lighting & Geometry ---
const ambientLight = new THREE.AmbientLight(0x222233, 1.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x00f0ff, 3, 30);
pointLight.position.set(0, 0, 5);
scene.add(pointLight);

const baseRadius = 2.4;
const geometry = new THREE.IcosahedronGeometry(baseRadius, 5);

// --- Audio DataTexture & ShaderMaterial ---
const audioData = new Uint8Array(256);
const u_audioTexture = new THREE.DataTexture(
  audioData,
  256,
  1,
  THREE.LuminanceFormat,
  THREE.UnsignedByteType
);
u_audioTexture.needsUpdate = true;

const outerMaterial = new THREE.ShaderMaterial({
  wireframe: true,
  uniforms: {
    u_audioTexture: { value: u_audioTexture },
    u_time: { value: 0.0 },
    u_bass: { value: 0.0 },
    u_baseColor: { value: new THREE.Color(0x111122) },
  },
  vertexShader: `
    uniform sampler2D u_audioTexture;
    uniform float u_time;
    uniform float u_bass;

    varying vec2 vUv;
    varying float vAudio;

    void main() {
      vUv = uv;

      // Sample u_audioTexture along uv.x
      float audioVal = texture2D(u_audioTexture, vec2(uv.x, 0.5)).r;
      vAudio = audioVal;

      // Subtle sine wave driven by u_time and u_bass
      float wave = sin(position.x * 2.0 + u_time * 3.0) * cos(position.y * 2.0 + u_time * 2.0);
      float displacement = (audioVal * 0.75) + (wave * 0.15 * (1.0 + u_bass * 1.5)) + (u_bass * 0.25);

      vec3 displaced = position + normal * displacement;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 u_baseColor;
    uniform float u_bass;

    varying vec2 vUv;
    varying float vAudio;

    void main() {
      // Wireframe illuminated edges with audio-driven brightness
      vec3 illuminated = u_baseColor * 3.5 + vec3(0.08, 0.12, 0.22);
      float brightness = 1.0 + (vAudio * 3.0) + (u_bass * 2.0);
      gl_FragColor = vec4(illuminated * brightness, 1.0);
    }
  `,
});
outerMaterial.color = outerMaterial.uniforms.u_baseColor.value;

const outerMesh = new THREE.Mesh(geometry, outerMaterial);
scene.add(outerMesh);


const coreGeo = new THREE.IcosahedronGeometry(1.2, 4);
const coreMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0055,
  wireframe: true,
  transparent: true,
  opacity: 0.7,
});
const coreMesh = new THREE.Mesh(coreGeo, coreMaterial);
scene.add(coreMesh);

const { mesh: particles, material: particleMat } = createParticleField(2500);
scene.add(particles);

// --- Mood Palettes ---
const PALETTES = {
  1: { name: 'Cyberpunk', bg: 0x05050c, light: 0x00f0ff, core: 0xff0055, wire: 0x111122 },
  2: { name: 'Lo-Fi Amber', bg: 0x0c0806, light: 0xffaa55, core: 0xd97736, wire: 0x1a120c },
  3: { name: 'Neon Synth', bg: 0x05020c, light: 0x7928ca, core: 0x00dfd8, wire: 0x0a0a14 },
  4: { name: 'Monochrome', bg: 0x000000, light: 0xffffff, core: 0xaaaaaa, wire: 0x222222 }
};

let currentPalette = PALETTES[1];

function applyPalette(theme) {
  currentPalette = theme;
  scene.background.setHex(theme.bg);
  scene.fog.color.setHex(theme.bg);
  pointLight.color.setHex(theme.light);
  coreMaterial.color.setHex(theme.core);
  outerMaterial.uniforms.u_baseColor.value.setHex(theme.wire);
  if (outerMaterial.color) outerMaterial.color.setHex(theme.wire);
  particleMat.color.setHex(theme.light);
  document.getElementById('status').innerText = `Preset Active: ${theme.name}`;
}

window.addEventListener('keydown', (e) => {
  if (PALETTES[e.key]) applyPalette(PALETTES[e.key]);
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
});

// --- Web Audio Loopback ---
let audioContext, analyser, freqData, beatDetector;
let isCapturing = false;
let smoothBass = 0, smoothMid = 0, smoothHigh = 0;

const lerp = (start, end, factor) => start + (end - start) * factor;

async function initSystemAudio() {
  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          systemAudio: 'include',
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
    } catch (fallbackErr) {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      alert('No audio track selected! Switch to "Entire Screen" or an active tab and check "Share audio".');
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    stream.getVideoTracks().forEach(track => track.stop());

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') await audioContext.resume();

    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    freqData = new Uint8Array(analyser.frequencyBinCount);
    beatDetector = new BeatDetector(analyser);
    isCapturing = true;

    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('status').innerText = 'Audio Source: Connected';

    audioTracks[0].onended = () => {
      isCapturing = false;
      document.getElementById('start-btn').style.display = 'block';
      document.getElementById('status').innerText = 'Status: Disconnected';
    };
  } catch (err) {
    document.getElementById('status').innerText = `Status: ${err.name || 'Capture Error'}`;
  }
}

document.getElementById('start-btn').addEventListener('click', initSystemAudio);

// --- Fullscreen & HUD Controller ---
const ui = document.getElementById('ui');
const fullscreenBtn = document.getElementById('fullscreen-btn');

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}
fullscreenBtn.addEventListener('click', toggleFullscreen);

let hideTimeout;
function resetUiTimer() {
  ui.classList.remove('ui-hidden');
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    if (isCapturing || document.fullscreenElement) ui.classList.add('ui-hidden');
  }, 3500);
}

window.addEventListener('mousemove', resetUiTimer);
document.addEventListener('fullscreenchange', () => {
  fullscreenBtn.innerText = document.fullscreenElement ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
  resetUiTimer();
});

// --- Render Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  let targetBass = 0, targetMid = 0, targetHigh = 0;

  if (isCapturing && analyser) {
    analyser.getByteFrequencyData(freqData);

    // Copy freqData to DataTexture buffer and set needsUpdate = true
    u_audioTexture.image.data.set(freqData);
    u_audioTexture.needsUpdate = true;

    let bassSum = 0;
    for (let i = 1; i <= 8; i++) bassSum += freqData[i];
    targetBass = (bassSum / 8) / 255;

    let midSum = 0;
    for (let i = 12; i <= 50; i++) midSum += freqData[i];
    targetMid = (midSum / 38) / 255;

    let highSum = 0;
    for (let i = 80; i <= 180; i++) highSum += freqData[i];
    targetHigh = (highSum / 100) / 255;

    // Check beat detection on onset hit
    if (beatDetector && beatDetector.checkBeat()) {
      if (chromaticAberrationPass && chromaticAberrationPass.uniforms && chromaticAberrationPass.uniforms.u_offset) {
        chromaticAberrationPass.uniforms.u_offset.value = 0.018;
      }
      camera.fov -= 6;
    }
  }

  smoothBass = lerp(smoothBass, targetBass, smoothBass < targetBass ? 0.45 : 0.08);
  smoothMid = lerp(smoothMid, targetMid, smoothMid < targetMid ? 0.3 : 0.08);
  smoothHigh = lerp(smoothHigh, targetHigh, smoothHigh < targetHigh ? 0.5 : 0.1);

  // Mesh pulses
  const scale = 1 + (smoothBass * 0.45);
  outerMesh.scale.set(scale, scale, scale);
  coreMesh.scale.set(1 + smoothBass * 0.7, 1 + smoothBass * 0.7, 1 + smoothBass * 0.7);

  // Dynamic Bloom
  bloomPass.strength = 1.0 + (smoothBass * 2.2);

  // Rotations
  outerMesh.rotation.x += 0.003 + (smoothHigh * 0.04);
  outerMesh.rotation.y += 0.005 + (smoothMid * 0.03);
  coreMesh.rotation.y -= 0.006;
  particles.rotation.y += 0.0005 + (smoothHigh * 0.004);

  // Update outerMesh shader uniforms
  outerMaterial.uniforms.u_time.value = time;
  outerMaterial.uniforms.u_bass.value = smoothBass;

  // Lerp chromatic aberration offset back toward 0.001
  if (chromaticAberrationPass && chromaticAberrationPass.uniforms && chromaticAberrationPass.uniforms.u_offset) {
    chromaticAberrationPass.uniforms.u_offset.value = lerp(
      chromaticAberrationPass.uniforms.u_offset.value,
      0.001,
      0.08
    );
  }

  // Smooth camera.fov back to baseline
  const baselineFov = 60 - (smoothBass * 7);
  camera.fov = lerp(camera.fov, baselineFov, 0.08);
  camera.position.x = Math.sin(time * 0.25) * 0.5;
  camera.position.y = Math.cos(time * 0.2) * 0.35;
  camera.updateProjectionMatrix();

  composer.render();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});