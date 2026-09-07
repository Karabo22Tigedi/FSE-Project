import * as THREE from "three"

export type ThreeLoopSetup = (ctx: {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
}) => {
  update: (t: number, dt: number) => void
  dispose?: () => void
}

export type ThreeLoopConfig = {
  alpha?: boolean
  clearColor?: number
  fov?: number
  cam?: readonly [number, number, number]
  lookAt?: readonly [number, number, number]
  dprCap?: number
  onReady?: () => void
  setup: ThreeLoopSetup
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const material = mesh.material
    if (Array.isArray(material)) {
      for (const item of material) item.dispose()
    } else {
      material.dispose()
    }
  })
}

export function startThreeLoop(canvas: HTMLCanvasElement, config: ThreeLoopConfig): () => void {
  let readyCalled = false
  const callReady = () => {
    if (readyCalled) return
    readyCalled = true
    config.onReady?.()
  }

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: config.alpha ?? false,
      powerPreference: "high-performance",
    })
  } catch {
    callReady()
    return () => {}
  }

  if (config.clearColor != null) {
    renderer.setClearColor(config.clearColor, 1)
  } else if (config.alpha) {
    renderer.setClearColor(0x000000, 0)
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(config.fov ?? 34, 1, 0.1, 80)
  const cam = config.cam ?? [0, 1.7, 6.2]
  camera.position.set(cam[0], cam[1], cam[2])
  const look = config.lookAt ?? [0.35, 0.15, 0]
  camera.lookAt(look[0], look[1], look[2])

  let built: { update: (t: number, dt: number) => void; dispose?: () => void }
  try {
    built = config.setup({ scene, camera, renderer })
  } catch {
    renderer.dispose()
    callReady()
    return () => {}
  }

  const dprCap = config.dprCap ?? 1.5
  const parent = canvas.parentElement ?? canvas

  const resize = () => {
    const w = Math.max(1, parent.clientWidth)
    const h = Math.max(1, parent.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  let raf = 0
  let last = performance.now()
  let visible = true
  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true
    },
    { rootMargin: "120px" },
  )
  io.observe(parent)

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (!visible) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    built.update(now / 1000, dt)
    renderer.render(scene, camera)
    callReady()
  }
  raf = requestAnimationFrame(tick)

  const onWinResize = () => resize()
  window.addEventListener("resize", onWinResize)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener("resize", onWinResize)
    io.disconnect()
    built.dispose?.()
    disposeObject(scene)
    renderer.dispose()
  }
}
