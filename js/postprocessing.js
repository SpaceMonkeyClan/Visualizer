export const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    u_offset: { value: 0.0008 },
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
    uniform float u_offset;
    varying vec2 vUv;

    void main() {
      float r = texture2D(tDiffuse, vUv + vec2(u_offset, 0.0)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - vec2(u_offset, 0.0)).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export const CinematicPostShader = {
  uniforms: {
    tDiffuse: { value: null },
    u_time: { value: 0.0 },
    u_grainIntensity: { value: 0.03 },
    u_vignetteDarkness: { value: 0.45 },
    u_vignetteOffset: { value: 1.2 },
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
    uniform float u_time;
    uniform float u_grainIntensity;
    uniform float u_vignetteDarkness;
    uniform float u_vignetteOffset;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Film grain to soften dark bands and add organic texture
      float noise = (rand(vUv + fract(u_time * 0.13)) - 0.5) * u_grainIntensity;
      color.rgb += noise;

      // Subtle circular vignette
      vec2 coord = (vUv - 0.5) * 2.0;
      float dist = length(coord);
      float vignette = smoothstep(u_vignetteOffset, u_vignetteOffset - 0.7, dist);
      color.rgb = mix(color.rgb * (1.0 - u_vignetteDarkness), color.rgb, vignette);

      gl_FragColor = color;
    }
  `,
};

export function setupPostProcessing(renderer, scene, camera) {
  const composer = new THREE.EffectComposer(renderer);
  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85, // balanced base strength
    0.4,  // soft radius
    0.2   // threshold for cleaner highlights
  );
  composer.addPass(bloomPass);

  const chromaticAberrationPass = new THREE.ShaderPass(ChromaticAberrationShader);
  composer.addPass(chromaticAberrationPass);

  const cinematicPass = new THREE.ShaderPass(CinematicPostShader);
  composer.addPass(cinematicPass);

  return { composer, bloomPass, chromaticAberrationPass, cinematicPass };
}