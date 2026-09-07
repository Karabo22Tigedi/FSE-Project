import * as THREE from "three"

function studioEnv(): THREE.CubeTexture {
  const hexes = ["#c9d8f5", "#8eaae4", "#ffffff", "#2c71f6", "#e8ebe8", "#9ad9cc"]
  const images = hexes.map((hex) => {
    const canvas = document.createElement("canvas")
    canvas.width = 8
    canvas.height = 8
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.fillStyle = hex
      ctx.fillRect(0, 0, 8, 8)
    }
    return canvas
  })
  const texture = new THREE.CubeTexture(images)
  texture.needsUpdate = true
  return texture
}

export function addStudioLights(scene: THREE.Scene, ground = 0x2c71f6): void {
  if (!scene.environment) scene.environment = studioEnv()
  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const hemi = new THREE.HemisphereLight(0xffffff, ground, 0.95)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xffffff, 1.35)
  key.position.set(4.2, 7.5, 5.5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x9ec0ff, 0.7)
  fill.position.set(-5, 2.4, -2)
  scene.add(fill)
  const rim = new THREE.PointLight(0x3de0c4, 1.1, 18)
  rim.position.set(-2.4, 2.2, 3)
  scene.add(rim)
}

function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2
  const y = -height / 2
  const r = Math.min(radius, width / 2, height / 2)
  const shape = new THREE.Shape()
  shape.moveTo(x + r, y)
  shape.lineTo(x + width - r, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + r)
  shape.lineTo(x + width, y + height - r)
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  shape.lineTo(x + r, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

function makeIosScreenMap(): THREE.CanvasTexture {
  const width = 512
  const height = 1112
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, "#5aa0ff")
  sky.addColorStop(0.38, "#2c71f6")
  sky.addColorStop(1, "#12204a")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = "rgba(255,255,255,0.18)"
  ctx.beginPath()
  ctx.ellipse(120, 210, 160, 90, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "rgba(61,224,196,0.16)"
  ctx.beginPath()
  ctx.ellipse(400, 780, 180, 120, 0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.font = "600 108px Poppins, system-ui, sans-serif"
  ctx.fillText("9:41", width / 2, 268)
  ctx.globalAlpha = 0.88
  ctx.font = "500 30px Poppins, system-ui, sans-serif"
  ctx.fillText("Monday 7 September", width / 2, 318)
  ctx.globalAlpha = 1

  const cardX = 48
  const cardY = 430
  const cardW = width - 96
  const cardH = 210
  ctx.fillStyle = "rgba(20,24,36,0.38)"
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, 28)
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.18)"
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.textAlign = "left"
  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.font = "500 22px Poppins, system-ui, sans-serif"
  ctx.fillText("XRPL Remit", cardX + 28, cardY + 48)
  ctx.fillStyle = "#ffffff"
  ctx.font = "600 44px Poppins, system-ui, sans-serif"
  ctx.fillText("R 500", cardX + 28, cardY + 112)
  ctx.fillStyle = "#3de0c4"
  ctx.font = "500 26px Poppins, system-ui, sans-serif"
  ctx.fillText("28.88 RLUSD on Testnet", cardX + 28, cardY + 162)

  const dockY = height - 150
  const colors = ["#2c71f6", "#3de0c4", "#f1f1f1", "#e8c872"]
  colors.forEach((color, i) => {
    const x = 118 + i * 92
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, dockY, 64, 64, 18)
    ctx.fill()
  })

  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.beginPath()
  ctx.roundRect(width / 2 - 70, height - 42, 140, 6, 3)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
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

function phonePlate(width: number, height: number, depth: number, radius: number, holeInset = 0) {
  const outline = roundedRect(width, height, radius)
  if (holeInset > 0) {
    outline.holes.push(
      roundedRect(width - holeInset, height - holeInset, Math.max(0.08, radius - holeInset * 0.45)),
    )
  }
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth,
    bevelEnabled: false,
    curveSegments: 16,
  })
  geometry.translate(0, 0, -depth / 2)
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

export function makePhone(): THREE.Group {
  const group = new THREE.Group()
  const width = 2.02
  const height = 4.36
  const depth = 0.14
  const radius = 0.42
  const frontY = depth / 2 + 0.008

  const titanium = new THREE.MeshStandardMaterial({
    color: 0xe4e0d8,
    metalness: 0.55,
    roughness: 0.28,
  })
  const backGlass = new THREE.MeshStandardMaterial({
    color: 0xd0ccc4,
    metalness: 0.35,
    roughness: 0.22,
  })
  const blackGlass = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.25,
    roughness: 0.22,
  })
  const lensGlass = new THREE.MeshStandardMaterial({
    color: 0x243044,
    metalness: 0.7,
    roughness: 0.12,
  })
  const flashMat = new THREE.MeshStandardMaterial({
    color: 0xf4e7c4,
    emissive: 0xf4e7c4,
    emissiveIntensity: 0.4,
    roughness: 0.25,
  })
  const screenMat = new THREE.MeshBasicMaterial({
    map: makeIosScreenMap(),
    side: THREE.DoubleSide,
  })

  const frame = new THREE.Mesh(phonePlate(width, height, depth, radius, 0.055), titanium)
  const back = new THREE.Mesh(phonePlate(width - 0.03, height - 0.03, 0.025, radius - 0.03), backGlass)
  back.position.y = -depth / 2 - 0.01
  group.add(frame, back)

  const screenW = width - 0.08
  const screenH = height - 0.08
  const screenGeo = new THREE.ShapeGeometry(roundedRect(screenW, screenH, radius - 0.05), 14)
  const screenPos = screenGeo.attributes.position
  const screenUv = new Float32Array(screenPos.count * 2)
  for (let i = 0; i < screenPos.count; i += 1) {
    screenUv[i * 2] = (screenPos.getX(i) + screenW / 2) / screenW
    screenUv[i * 2 + 1] = (screenPos.getY(i) + screenH / 2) / screenH
  }
  screenGeo.setAttribute("uv", new THREE.BufferAttribute(screenUv, 2))
  const screen = new THREE.Mesh(screenGeo, screenMat)
  screen.rotation.x = -Math.PI / 2
  screen.position.y = frontY
  group.add(screen)

  const island = new THREE.Mesh(phonePlate(0.56, 0.13, 0.018, 0.065), blackGlass)
  island.position.set(0, frontY + 0.012, -1.86)
  group.add(island)

  const bump = new THREE.Mesh(phonePlate(0.98, 0.98, 0.08, 0.24), titanium)
  bump.position.set(0.44, -depth / 2 - 0.055, -1.44)
  group.add(bump)
  const lensSpots: Array<readonly [number, number]> = [
    [0.2, -1.68],
    [0.68, -1.68],
    [0.2, -1.2],
  ]
  for (const [x, z] of lensSpots) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.045, 24), titanium)
    ring.position.set(x, -depth / 2 - 0.09, z)
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.035, 24), lensGlass)
    glass.position.set(x, -depth / 2 - 0.11, z)
    group.add(ring, glass)
  }
  const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), flashMat)
  flash.position.set(0.68, -depth / 2 - 0.09, -1.24)
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 16), blackGlass)
  lidar.position.set(0.68, -depth / 2 - 0.09, -1.4)
  group.add(flash, lidar)

  const volumeUp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.26), titanium)
  volumeUp.position.set(-width / 2 - 0.01, 0, -0.7)
  const volumeDown = volumeUp.clone()
  volumeDown.position.z = -0.34
  const action = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.15), titanium)
  action.position.set(-width / 2 - 0.01, 0, -1.26)
  const power = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.32), titanium)
  power.position.set(width / 2 + 0.01, 0, -0.52)
  group.add(volumeUp, volumeDown, action, power)

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
