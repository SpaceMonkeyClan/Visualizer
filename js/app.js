import { BeatDetector } from './audioAnalysis.js';
import { createParticleField, updateParticles } from './particles.js';
import { setupPostProcessing } from './postprocessing.js';

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const baseBgColor = 0x05050c;
scene.background = new THREE.Color(baseBgColor);
scene.fog = new THREE.FogExp2(baseBgColor, 0.035);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
container.appendChild(renderer.domElement);

const { composer, bloomPass, chromaticAberrationPass, cinematicPass } = setupPostProcessing(renderer, scene, camera);

// --- Lighting & Geometry ---
const ambientLight = new THREE.AmbientLight(0x222233, 1.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x00f0ff, 3, 30);
pointLight.position.set(0, 0, 5);
scene.add(pointLight);

const baseRadius = 2.4;
const geometry = new THREE.IcosahedronGeometry(baseRadius, 4);

// --- Audio DataTexture & ShaderMaterial ---
const audioData = new Uint8Array(256);
const smoothAudioData = new Float32Array(256);
const u_audioTexture = new THREE.DataTexture(
  audioData,
  256,
  1,
  THREE.LuminanceFormat,
  THREE.UnsignedByteType
);
u_audioTexture.minFilter = THREE.LinearFilter;
u_audioTexture.magFilter = THREE.LinearFilter;
u_audioTexture.generateMipmaps = false;
u_audioTexture.needsUpdate = true;

// --- Spectral Outer Mesh Shader ---
const outerMaterial = new THREE.ShaderMaterial({
  wireframe: true,
  uniforms: {
    u_audioTexture: { value: u_audioTexture },
    u_time: { value: 0.0 },
    u_bass: { value: 0.0 },
    u_colorBass: { value: new THREE.Color(0x990044) },
    u_colorMid: { value: new THREE.Color(0x00d4ff) },
    u_colorHigh: { value: new THREE.Color(0xffffff) },
  },
  vertexShader: `
    uniform sampler2D u_audioTexture;
    uniform float u_time;
    uniform float u_bass;

    varying vec2 vUv;
    varying float vAudio;
    varying float vElevation;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normal;

      // Sample u_audioTexture along uv.x with smooth linear interpolation
      float audioVal = texture2D(u_audioTexture, vec2(uv.x, 0.5)).r;
      vAudio = audioVal;

      // Liquid cosmic gravitational waves - slow, heavy, deep
      float wave = sin(position.x * 1.0 + u_time * 0.6) * cos(position.y * 1.0 + u_time * 0.45);
      float displacement = (audioVal * 0.4) + (wave * 0.08 * (1.0 + u_bass * 0.6)) + (u_bass * 0.12);

      vec3 displaced = position + normal * displacement;
      vElevation = (displaced.y / 2.4) * 0.5 + 0.5;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 u_colorBass;
    uniform vec3 u_colorMid;
    uniform vec3 u_colorHigh;
    uniform float u_bass;

    varying vec2 vUv;
    varying float vAudio;
    varying float vElevation;

    void main() {
      // Dynamic multi-frequency spectral gradient
      vec3 col = mix(u_colorBass, u_colorMid, smoothstep(0.15, 0.75, vElevation));
      col = mix(col, u_colorHigh, smoothstep(0.55, 0.95, vAudio));

      // Gentle, atmospheric illumination
      float brightness = 0.85 + (vAudio * 1.1) + (u_bass * 0.6);
      gl_FragColor = vec4(col * brightness, 1.0);
    }
  `,
});

const outerMesh = new THREE.Mesh(geometry, outerMaterial);
scene.add(outerMesh);

// --- Fresnel Singularity Core (Smooth, glowing celestial void orb) ---
const coreGeo = new THREE.IcosahedronGeometry(1.22, 4);
const coreMaterial = new THREE.ShaderMaterial({
  wireframe: false,
  transparent: true,
  blending: THREE.AdditiveBlending,
  uniforms: {
    u_time: { value: 0.0 },
    u_bass: { value: 0.0 },
    u_mid: { value: 0.0 },
    u_color: { value: new THREE.Color(0xff0055) },
    u_fresnelColor: { value: new THREE.Color(0x00ffff) },
  },
  vertexShader: `
    uniform float u_time;
    uniform float u_bass;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPos.xyz);

      // Heavy, slow gravitational pulse
      float pulse = sin(position.x * 2.0 + u_time * 1.2) * (0.02 + u_bass * 0.04);
      vec3 displaced = position + normal * pulse;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 u_color;
    uniform vec3 u_fresnelColor;
    uniform float u_bass;
    uniform float u_mid;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      // Soft, celestial event-horizon rim glow
      float fresnel = clamp(1.0 - abs(dot(vNormal, vViewDir)), 0.0, 1.0);
      fresnel = pow(fresnel, 2.2);

      vec3 coreGlow = mix(u_color * 0.25, u_fresnelColor * 1.2, fresnel);
      float intensity = 0.65 + (u_bass * 0.5) + (u_mid * 0.25);

      gl_FragColor = vec4(coreGlow * intensity, fresnel * 0.85 + 0.08);
    }
  `,
});

const coreMesh = new THREE.Mesh(coreGeo, coreMaterial);
scene.add(coreMesh);

// Delicate accretion orbit ring around the singularity
const ringGeo = new THREE.TorusGeometry(1.48, 0.012, 16, 120);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  transparent: true,
  opacity: 0.4,
  blending: THREE.AdditiveBlending
});
const ringMesh = new THREE.Mesh(ringGeo, ringMat);
ringMesh.rotation.x = Math.PI * 0.38;
scene.add(ringMesh);

// --- Deep Space Celestial Field (800 clean stars) ---
const particleSystem = createParticleField(800);
scene.add(particleSystem.mesh);

// --- Mood Palettes ---
const PALETTES = {
  1: {
    name: 'Cyberpunk',
    bg: 0x05050c,
    light: 0x00f0ff,
    colorBass: new THREE.Color(0x990044),
    colorMid: new THREE.Color(0x00d4ff),
    colorHigh: new THREE.Color(0xffffff),
    core: new THREE.Color(0xff0055),
    coreFresnel: new THREE.Color(0x00ffff),
    particleColor: 0x00f0ff
  },
  2: {
    name: 'Lo-Fi Amber',
    bg: 0x0c0806,
    light: 0xffaa55,
    colorBass: new THREE.Color(0x662200),
    colorMid: new THREE.Color(0xd97736),
    colorHigh: new THREE.Color(0xffeedd),
    core: new THREE.Color(0xd97736),
    coreFresnel: new THREE.Color(0xffd59e),
    particleColor: 0xffaa55
  },
  3: {
    name: 'Neon Synth',
    bg: 0x05020c,
    light: 0x7928ca,
    colorBass: new THREE.Color(0x440066),
    colorMid: new THREE.Color(0x00dfd8),
    colorHigh: new THREE.Color(0xff70a6),
    core: new THREE.Color(0x00dfd8),
    coreFresnel: new THREE.Color(0xff2a85),
    particleColor: 0x7928ca
  },
  4: {
    name: 'Monochrome',
    bg: 0x000000,
    light: 0xffffff,
    colorBass: new THREE.Color(0x222222),
    colorMid: new THREE.Color(0x888888),
    colorHigh: new THREE.Color(0xffffff),
    core: new THREE.Color(0xaaaaaa),
    coreFresnel: new THREE.Color(0xffffff),
    particleColor: 0xaaaaaa
  }
};

let currentPalette = PALETTES[1];

function applyPalette(theme) {
  currentPalette = theme;
  scene.background.setHex(theme.bg);
  scene.fog.color.setHex(theme.bg);
  pointLight.color.setHex(theme.light);

  outerMaterial.uniforms.u_colorBass.value.copy(theme.colorBass);
  outerMaterial.uniforms.u_colorMid.value.copy(theme.colorMid);
  outerMaterial.uniforms.u_colorHigh.value.copy(theme.colorHigh);

  coreMaterial.uniforms.u_color.value.copy(theme.core);
  coreMaterial.uniforms.u_fresnelColor.value.copy(theme.coreFresnel);
  ringMat.color.copy(theme.coreFresnel);

  particleSystem.material.color.setHex(theme.particleColor);

  document.querySelectorAll('.pill-btn').forEach(btn => {
    const presetId = btn.getAttribute('data-preset');
    btn.classList.toggle('active', PALETTES[presetId] === theme);
  });
  document.getElementById('status').innerText = `Preset: ${theme.name}`;
}

// Preset Pills & Keyboard handlers
document.querySelectorAll('.pill-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const preset = PALETTES[btn.getAttribute('data-preset')];
    if (preset) applyPalette(preset);
  });
});

window.addEventListener('keydown', (e) => {
  if (PALETTES[e.key]) applyPalette(PALETTES[e.key]);
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  if (e.key === ' ') {
    e.preventDefault();
    togglePlayPause();
  }
});

// --- Orbit Controls & Camera Dynamics ---
let azimuth = 0, targetAzimuth = 0;
let polar = Math.PI / 2, targetPolar = Math.PI / 2;
let distance = 8.0, targetDistance = 8.0;
let isDragging = false;
let pointerX = 0, pointerY = 0;

container.addEventListener('pointerdown', (e) => {
  isDragging = true;
  pointerX = e.clientX;
  pointerY = e.clientY;
});

window.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const deltaX = e.clientX - pointerX;
  const deltaY = e.clientY - pointerY;
  pointerX = e.clientX;
  pointerY = e.clientY;

  targetAzimuth -= deltaX * 0.006;
  targetPolar = Math.max(0.18, Math.min(Math.PI - 0.18, targetPolar - deltaY * 0.006));
});

window.addEventListener('pointerup', () => { isDragging = false; });
window.addEventListener('pointercancel', () => { isDragging = false; });

container.addEventListener('wheel', (e) => {
  e.preventDefault();
  targetDistance = Math.max(4.0, Math.min(18.0, targetDistance + e.deltaY * 0.008));
}, { passive: false });

// --- Audio Engine (System, Mic, File, Demo Synth) ---
let audioContext = null;
let analyser = null;
let freqData = null;
let beatDetector = null;
let isCapturing = false;
let smoothBass = 0, smoothMid = 0, smoothHigh = 0;
let fovPunch = 0;
let audioSensitivity = 1.0;

let currentMediaStream = null;
let currentAudioEl = null;
let demoSynth = null;
let currentSourceType = 'none';

const lerp = (start, end, factor) => start + (end - start) * factor;

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  if (!analyser) {
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.90;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    beatDetector = new BeatDetector(analyser);
  }
  return audioContext;
}

function cleanupCurrentSource() {
  if (currentMediaStream) {
    currentMediaStream.getTracks().forEach(t => t.stop());
    currentMediaStream = null;
  }
  if (currentAudioEl) {
    currentAudioEl.pause();
    currentAudioEl.src = '';
    currentAudioEl = null;
  }
  if (demoSynth) {
    demoSynth.stop();
    demoSynth = null;
  }
  document.getElementById('playback-bar').classList.add('hidden');
}

function setActiveSourceButton(buttonId) {
  document.querySelectorAll('.btn-row .btn').forEach(btn => btn.classList.remove('active-source'));
  const target = document.getElementById(buttonId);
  if (target) target.classList.add('active-source');
}

// 1. System Audio Capture
async function initSystemAudio() {
  cleanupCurrentSource();
  ensureAudioContext();
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
    } catch {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      alert('No audio track selected! Please check "Share audio" when picking a screen or tab.');
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    stream.getVideoTracks().forEach(track => track.stop());

    currentMediaStream = stream;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    isCapturing = true;
    currentSourceType = 'system';
    setActiveSourceButton('btn-source-system');
    document.getElementById('status').innerText = 'Source: System Audio Active';

    audioTracks[0].onended = () => {
      isCapturing = false;
      document.getElementById('status').innerText = 'Status: Disconnected';
      document.getElementById('btn-source-system').classList.remove('active-source');
    };
  } catch (err) {
    document.getElementById('status').innerText = `Status: ${err.name || 'Capture Error'}`;
  }
}

// 2. Microphone Input
async function initMicrophone() {
  cleanupCurrentSource();
  ensureAudioContext();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    currentMediaStream = stream;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    isCapturing = true;
    currentSourceType = 'mic';
    setActiveSourceButton('btn-source-mic');
    document.getElementById('status').innerText = 'Source: Microphone Live';

    stream.getAudioTracks()[0].onended = () => {
      isCapturing = false;
      document.getElementById('status').innerText = 'Status: Disconnected';
      document.getElementById('btn-source-mic').classList.remove('active-source');
    };
  } catch (err) {
    document.getElementById('status').innerText = `Status: ${err.name || 'Mic Denied'}`;
  }
}

// 3. Audio File Playback
function loadAudioFile(file) {
  cleanupCurrentSource();
  ensureAudioContext();

  const audioEl = new Audio();
  audioEl.src = URL.createObjectURL(file);
  audioEl.crossOrigin = 'anonymous';
  audioEl.loop = true;

  const source = audioContext.createMediaElementSource(audioEl);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  currentAudioEl = audioEl;
  audioEl.play().then(() => {
    isCapturing = true;
    currentSourceType = 'file';
    setActiveSourceButton('btn-source-file');

    const playbackBar = document.getElementById('playback-bar');
    const trackName = document.getElementById('track-name');
    const playPauseBtn = document.getElementById('btn-play-pause');

    trackName.innerText = file.name || 'Audio Track';
    playPauseBtn.innerText = '⏸ Pause';
    playbackBar.classList.remove('hidden');
    document.getElementById('status').innerText = 'Playing Audio File';
  }).catch(err => {
    document.getElementById('status').innerText = 'Playback Error: ' + err.message;
  });
}

// 4. Built-in Ambient Synth (Self-contained Web Audio generator)
function startDemoSynth() {
  cleanupCurrentSource();
  ensureAudioContext();

  const ctx = audioContext;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.35, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(450, ctx.currentTime);
  filter.Q.setValueAtTime(4, ctx.currentTime);

  // Sub bass drone
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sawtooth';
  subOsc.frequency.setValueAtTime(55, ctx.currentTime); // A1
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.4, ctx.currentTime);
  subOsc.connect(subGain).connect(filter);
  subOsc.start();

  // Fifth chord pad
  const padOsc1 = ctx.createOscillator();
  padOsc1.type = 'sine';
  padOsc1.frequency.setValueAtTime(110, ctx.currentTime); // A2
  padOsc1.connect(filter);
  padOsc1.start();

  const padOsc2 = ctx.createOscillator();
  padOsc2.type = 'triangle';
  padOsc2.frequency.setValueAtTime(164.81, ctx.currentTime); // E3
  padOsc2.connect(filter);
  padOsc2.start();

  // Filter LFO sweep
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(0.2, ctx.currentTime);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(350, ctx.currentTime);
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  // Arpeggiator & Kick Rhythm
  const notes = [220, 261.63, 329.63, 392, 440, 523.25, 659.25];
  let step = 0;
  const timer = setInterval(() => {
    if (ctx.state === 'suspended') return;
    const now = ctx.currentTime;

    // Arp note
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = step % 4 === 0 ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(notes[step % notes.length], now);

    env.gain.setValueAtTime(0.18, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(env).connect(filter);
    osc.start(now);
    osc.stop(now + 0.36);

    // Kick thump every 4 beats
    if (step % 4 === 0) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.frequency.setValueAtTime(120, now);
      kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
      kickGain.gain.setValueAtTime(0.65, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      kickOsc.connect(kickGain).connect(masterGain);
      kickOsc.start(now);
      kickOsc.stop(now + 0.22);
    }
    step++;
  }, 220);

  filter.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(ctx.destination);

  let isPlaying = true;
  demoSynth = {
    stop: () => {
      clearInterval(timer);
      try {
        subOsc.stop();
        padOsc1.stop();
        padOsc2.stop();
        lfo.stop();
      } catch {}
      masterGain.disconnect();
    },
    toggle: () => {
      if (isPlaying) {
        masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        isPlaying = false;
        return false;
      } else {
        masterGain.gain.setTargetAtTime(0.35, ctx.currentTime, 0.05);
        isPlaying = true;
        return true;
      }
    }
  };

  isCapturing = true;
  currentSourceType = 'demo';
  setActiveSourceButton('btn-source-demo');

  const playbackBar = document.getElementById('playback-bar');
  const trackName = document.getElementById('track-name');
  const playPauseBtn = document.getElementById('btn-play-pause');

  trackName.innerText = 'Ambient Synth & Beats';
  playPauseBtn.innerText = '⏸ Pause';
  playbackBar.classList.remove('hidden');
  document.getElementById('status').innerText = 'Playing Demo Synth';
}

function togglePlayPause() {
  const playPauseBtn = document.getElementById('btn-play-pause');
  if (currentSourceType === 'file' && currentAudioEl) {
    if (currentAudioEl.paused) {
      currentAudioEl.play();
      playPauseBtn.innerText = '⏸ Pause';
    } else {
      currentAudioEl.pause();
      playPauseBtn.innerText = '▶ Play';
    }
  } else if (currentSourceType === 'demo' && demoSynth) {
    const isPlaying = demoSynth.toggle();
    playPauseBtn.innerText = isPlaying ? '⏸ Pause' : '▶ Play';
  }
}

document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
document.getElementById('btn-source-system').addEventListener('click', initSystemAudio);
document.getElementById('btn-source-mic').addEventListener('click', initMicrophone);
document.getElementById('btn-source-demo').addEventListener('click', startDemoSynth);

const fileInput = document.getElementById('file-input');
document.getElementById('btn-source-file').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadAudioFile(e.target.files[0]);
  }
});

// Drag and drop overlay handlers
const dropzone = document.getElementById('dropzone');
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.remove('hidden');
});
window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) {
    dropzone.classList.add('hidden');
  }
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.add('hidden');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name)) {
      loadAudioFile(file);
    } else {
      document.getElementById('status').innerText = 'Error: Not an audio file';
    }
  }
});

// Sensitivity Slider
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityVal = document.getElementById('sensitivity-val');
sensitivitySlider.addEventListener('input', (e) => {
  audioSensitivity = parseFloat(e.target.value);
  sensitivityVal.innerText = `${audioSensitivity.toFixed(1)}x`;
});

// --- Fullscreen & Auto-Hiding UI ---
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
  }, 4500);
}

window.addEventListener('mousemove', resetUiTimer);
window.addEventListener('pointerdown', resetUiTimer);
document.addEventListener('fullscreenchange', () => {
  fullscreenBtn.innerText = document.fullscreenElement ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
  resetUiTimer();
});

// --- Render Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const dt = clock.getDelta();

  let targetBass = 0, targetMid = 0, targetHigh = 0;

  if (isCapturing && analyser) {
    analyser.getByteFrequencyData(freqData);

    // Apply sensitivity & smooth per-bin FFT data into DataTexture with gentle liquid attack/decay
    const attack = 0.16;
    const decay = 0.04;
    for (let i = 0; i < 256; i++) {
      const scaled = Math.min(255, freqData[i] * audioSensitivity);
      smoothAudioData[i] = lerp(smoothAudioData[i], scaled, smoothAudioData[i] < scaled ? attack : decay);
      audioData[i] = Math.round(smoothAudioData[i]);
    }
    u_audioTexture.needsUpdate = true;

    let bassSum = 0;
    for (let i = 1; i <= 8; i++) bassSum += audioData[i];
    targetBass = (bassSum / 8) / 255;

    let midSum = 0;
    for (let i = 12; i <= 50; i++) midSum += audioData[i];
    targetMid = (midSum / 38) / 255;

    let highSum = 0;
    for (let i = 80; i <= 180; i++) highSum += audioData[i];
    targetHigh = (highSum / 100) / 255;

    // Subtle cosmic beat reaction - soft gravitational lensing
    if (beatDetector && beatDetector.checkBeat()) {
      if (chromaticAberrationPass && chromaticAberrationPass.uniforms && chromaticAberrationPass.uniforms.u_offset) {
        chromaticAberrationPass.uniforms.u_offset.value = 0.0020;
      }
      fovPunch = 0.4;
    }
  }

  // Smooth audio bands with serene, heavy cosmic decay
  smoothBass = lerp(smoothBass, targetBass, smoothBass < targetBass ? 0.16 : 0.035);
  smoothMid = lerp(smoothMid, targetMid, smoothMid < targetMid ? 0.12 : 0.035);
  smoothHigh = lerp(smoothHigh, targetHigh, smoothHigh < targetHigh ? 0.12 : 0.04);

  // Mesh pulses - slow, majestic breathing
  const scale = 1 + (smoothBass * 0.15);
  outerMesh.scale.set(scale, scale, scale);
  coreMesh.scale.set(1 + smoothBass * 0.20, 1 + smoothBass * 0.20, 1 + smoothBass * 0.20);
  ringMesh.scale.set(1 + smoothBass * 0.18, 1 + smoothBass * 0.18, 1 + smoothBass * 0.18);

  // Atmospheric, gentle bloom
  bloomPass.strength = 0.65 + (smoothBass * 0.55);

  // Rotations - slow, serene cosmic drift
  outerMesh.rotation.x += 0.0006 + (smoothHigh * 0.004);
  outerMesh.rotation.y += 0.0010 + (smoothMid * 0.003);
  coreMesh.rotation.y -= 0.0012;
  coreMesh.rotation.x += 0.0006;
  ringMesh.rotation.z += 0.0015;

  // Audio-reactive particle vortex update
  updateParticles(particleSystem, smoothBass, smoothMid, smoothHigh, dt, fovPunch);

  // Update outerMesh shader uniforms
  outerMaterial.uniforms.u_time.value = time;
  outerMaterial.uniforms.u_bass.value = smoothBass;

  // Update coreMesh shader uniforms
  coreMaterial.uniforms.u_time.value = time;
  coreMaterial.uniforms.u_bass.value = smoothBass;
  coreMaterial.uniforms.u_mid.value = smoothMid;

  // Update post-processing uniforms
  if (cinematicPass && cinematicPass.uniforms && cinematicPass.uniforms.u_time) {
    cinematicPass.uniforms.u_time.value = time;
  }

  // Lerp chromatic aberration offset back toward rest value
  if (chromaticAberrationPass && chromaticAberrationPass.uniforms && chromaticAberrationPass.uniforms.u_offset) {
    chromaticAberrationPass.uniforms.u_offset.value = lerp(
      chromaticAberrationPass.uniforms.u_offset.value,
      0.0006,
      0.05
    );
  }

  // Camera Orbit Inertia & Serene Cinematic Drift
  azimuth = lerp(azimuth, targetAzimuth, 0.05);
  polar = lerp(polar, targetPolar, 0.05);
  distance = lerp(distance, targetDistance, 0.06);

  const driftAzimuth = azimuth + Math.sin(time * 0.15) * 0.04;
  const driftPolar = polar + Math.cos(time * 0.1) * 0.025;

  camera.position.x = distance * Math.sin(driftPolar) * Math.sin(driftAzimuth);
  camera.position.y = distance * Math.cos(driftPolar);
  camera.position.z = distance * Math.sin(driftPolar) * Math.cos(driftAzimuth);
  camera.lookAt(0, 0, 0);

  // Smooth camera.fov decay with gentle fovPunch
  fovPunch = lerp(fovPunch, 0, 0.05);
  const baselineFov = 60 - (smoothBass * 1.5) - fovPunch;
  camera.fov = lerp(camera.fov, baselineFov, 0.05);
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