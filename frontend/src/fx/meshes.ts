import * as THREE from "three"

export function addStudioLights(scene: THREE.Scene, ground = 0x2c71f6): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.42))
  const hemi = new THREE.HemisphereLight(0xffffff, ground, 0.85)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xffffff, 1.15)
  key.position.set(4.2, 7.5, 5.5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x9ec0ff, 0.45)
  fill.position.set(-5, 2.4, -2)
  scene.add(fill)
  const rim = new THREE.PointLight(0x3de0c4, 1.1, 18)
  rim.position.set(-2.4, 2.2, 3)
  scene.add(rim)
}

export function makeCoin(color: number, scale = 1): THREE.Group {
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.82,
    roughness: 0.26,
  })
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    metalness: 0.92,
    roughness: 0.18,
  })
  const markMat = new THREE.MeshStandardMaterial({
    color: 0x151515,
    metalness: 0.35,
    roughness: 0.45,
  })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 0.09 * scale, 48), metal)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5 * scale, 0.038 * scale, 10, 48), rimMat)
  rim.rotation.x = Math.PI / 2
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.22 * scale, 0.03 * scale, 8, 28), markMat)
  inner.rotation.x = Math.PI / 2
  inner.position.y = 0.02 * scale
  const pip = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.04 * scale, 0.12 * scale), markMat)
  pip.position.y = 0.04 * scale
  group.add(body, rim, inner, pip)
  return group
}

export function makePhone(): THREE.Group {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1b1b1b,
    metalness: 0.55,
    roughness: 0.32,
  })
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x2c71f6,
    emissive: 0x2c71f6,
    emissiveIntensity: 0.55,
    metalness: 0.1,
    roughness: 0.22,
  })
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0e1a33,
    metalness: 0.4,
    roughness: 0.15,
  })
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xf1f1f1,
    roughness: 0.4,
  })
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, 4.35), bodyMat)
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.04, 4.18), glassMat)
  bezel.position.y = 0.08
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.03, 3.55), screenMat)
  screen.position.y = 0.1
  group.add(body, bezel, screen)
  for (let i = 0; i < 4; i += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(1.05 - i * 0.12, 0.02, 0.08), lineMat)
    line.position.set(-0.18, 0.13, 0.85 - i * 0.28)
    group.add(line)
  }
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.025, 0.55), lineMat)
  chip.position.set(0.42, 0.13, -0.95)
  group.add(chip)
  return group
}

export function makeCraft(): THREE.Group {
  const group = new THREE.Group()
  const hull = new THREE.MeshStandardMaterial({
    color: 0xf1f1f1,
    metalness: 0.2,
    roughness: 0.35,
  })
  const accent = new THREE.MeshStandardMaterial({
    color: 0x2c71f6,
    metalness: 0.3,
    roughness: 0.3,
    emissive: 0x163a8a,
    emissiveIntensity: 0.35,
  })
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 0.42), hull)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), hull)
  nose.rotation.z = -Math.PI / 2
  nose.position.x = 0.72
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 1.55), hull)
  wing.position.y = -0.02
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.08), accent)
  tail.position.set(-0.52, 0.18, 0)
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.28), accent)
  canopy.position.set(0.18, 0.14, 0)
  group.add(body, nose, wing, tail, canopy)
  return group
}

export function makePacket(): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3de0c4,
    metalness: 0.25,
    roughness: 0.4,
    emissive: 0x0b4a40,
    emissiveIntensity: 0.2,
  })
  return new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mat)
}
