import * as THREE from "three"

const local = new THREE.Vector3()

/** Unscaled iPhone half-size in local axes: width, thickness, height. */
const PHONE_HALF = new THREE.Vector3(1.2, 0.55, 2.4)

export function keepOutsidePhone(phone: THREE.Object3D, object: THREE.Object3D, pad = 0.5): void {
  phone.updateMatrixWorld()
  local.copy(object.position)
  phone.worldToLocal(local)
  const hx = PHONE_HALF.x + pad
  const hy = PHONE_HALF.y + pad
  const hz = PHONE_HALF.z + pad
  const ax = Math.abs(local.x)
  const ay = Math.abs(local.y)
  const az = Math.abs(local.z)
  if (ax >= hx || ay >= hy || az >= hz) return

  const px = hx - ax
  const py = hy - ay
  const pz = hz - az
  if (px <= py && px <= pz) {
    local.x = (local.x < 0 ? -1 : 1) * hx
  } else if (py <= pz) {
    local.y = (local.y < 0 ? -1 : 1) * hy
  } else {
    local.z = (local.z < 0 ? -1 : 1) * hz
  }
  phone.localToWorld(local)
  object.position.copy(local)
}
