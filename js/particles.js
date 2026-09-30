// Procedural soft glowing circular star sprite - eliminates square billboard artifacts
function createStarSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.12, 'rgba(240, 245, 255, 0.9)');
  gradient.addColorStop(0.35, 'rgba(170, 210, 255, 0.4)');
  gradient.addColorStop(0.7, 'rgba(100, 150, 255, 0.08)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export function createParticleField(count = 800) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const angles = new Float32Array(count);
  const speeds = new Float32Array(count);
  const heights = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Deep cosmic space distribution: vast expanse from radius 4 to 75
    const u = Math.random();
    const r = 4.0 + Math.pow(u, 1.5) * 70.0;
    radii[i] = r;

    // Uniform spherical / circular azimuth
    angles[i] = Math.random() * Math.PI * 2;

    // Slow, serene celestial drift - vast cosmic timescale
    speeds[i] = (0.015 + Math.random() * 0.025) / Math.sqrt(r * 0.15 + 1.0);

    // Deep vertical volume
    heights[i] = (Math.random() - 0.5) * (14.0 + r * 0.55);

    positions[i * 3] = Math.cos(angles[i]) * r;
    positions[i * 3 + 1] = heights[i];
    positions[i * 3 + 2] = Math.sin(angles[i]) * r;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', positionAttribute);

  // Soft glowing point star material
  const material = new THREE.PointsMaterial({
    size: 0.28,
    map: createStarSprite(),
    color: 0x99ccff,
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

  // Gentle, heavy cosmic gravity & expansion
  const expansion = 1.0 + (smoothBass * 0.15);
  const swirlRate = 1.0 + (smoothMid * 0.6);
  const shimmer = smoothHigh * 0.3;

  for (let i = 0; i < count; i++) {
    // Gentle celestial orbit
    angles[i] += speeds[i] * swirlRate * dt;

    const r = radii[i] * expansion;
    const a = angles[i];

    positions[i * 3] = Math.cos(a) * r;
    // Slow, flowing cosmic wave
    positions[i * 3 + 1] = heights[i] + Math.sin(a * 1.5 + r * 0.1) * (0.2 + shimmer);
    positions[i * 3 + 2] = Math.sin(a) * r;
  }

  positionAttribute.needsUpdate = true;
}