export function createParticleField(count = 2500) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 50;
    positions[i + 1] = (Math.random() - 0.5) * 50;
    positions[i + 2] = (Math.random() - 0.5) * 50;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.05,
    color: 0x88ccff,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending
  });

  const mesh = new THREE.Points(geometry, material);
  return { mesh, material };
}