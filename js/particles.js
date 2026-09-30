export function createParticleField(count = 3000) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const angles = new Float32Array(count);
  const speeds = new Float32Array(count);
  const heights = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Logarithmic distribution: denser near the core (radius 2.6 to 24)
    const u = Math.random();
    const r = 2.6 + Math.pow(u, 1.8) * 22;
    radii[i] = r;

    // Golden angle distribution for natural spiral appearance
    angles[i] = Math.random() * Math.PI * 2;

    // Keplerian orbital speed: faster near core, gentler at periphery
    speeds[i] = (0.25 + Math.random() * 0.35) / Math.sqrt(r * 0.4);

    // Height distribution with gentle bell curve
    heights[i] = (Math.random() - 0.5) * (6.0 + r * 0.45);

    positions[i * 3] = Math.cos(angles[i]) * r;
    positions[i * 3 + 1] = heights[i];
    positions[i * 3 + 2] = Math.sin(angles[i]) * r;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', positionAttribute);

  const material = new THREE.PointsMaterial({
    size: 0.055,
    color: 0x88ccff,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Points(geometry, material);

  return {
    mesh,
    material,
    geometry,
    positions,
    positionAttribute,
    radii,
    angles,
    speeds,
    heights,
    count
  };
}

export function updateParticles(system, smoothBass, smoothMid, smoothHigh, dt, fovPunch = 0) {
  if (!system) return;
  const { positions, positionAttribute, radii, angles, speeds, heights, count } = system;

  // Audio-driven dynamics
  const expansion = 1.0 + (smoothBass * 0.32) + (fovPunch * 0.06);
  const swirlRate = 1.0 + (smoothMid * 1.8);
  const highWave = smoothHigh * 1.1;

  for (let i = 0; i < count; i++) {
    // Advance orbital angle
    angles[i] += speeds[i] * swirlRate * dt;

    const r = radii[i] * expansion;
    const a = angles[i];

    positions[i * 3] = Math.cos(a) * r;
    // Harmonic vertical undulating wave driven by mid/high frequencies
    positions[i * 3 + 1] = heights[i] + Math.sin(a * 2.5 + r * 0.3) * (0.3 + highWave);
    positions[i * 3 + 2] = Math.sin(a) * r;
  }

  positionAttribute.needsUpdate = true;
}