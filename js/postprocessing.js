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

  return { composer, bloomPass, chromaticAberrationPass };
}