import { useEffect, useRef } from "react"
import { keepOutsidePhone } from "./keepOutside"
import { addStudioLights, makeCoin, makePacket, makePhone } from "./meshes"
import { disposeObject, startThreeLoop } from "./threeCanvas"

export function RequestsScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    return startThreeLoop(canvas, {
      alpha: true,
      fov: 36,
      cam: [0, 0.35, 5.2],
      lookAt: [0, 0.1, 0],
      setup: ({ scene }) => {
        addStudioLights(scene, 0x151515)
        const phone = makePhone()
        phone.scale.setScalar(0.72)
        phone.rotation.set(-0.18, -0.42, 0.08)
        phone.position.set(-0.15, -0.15, 0)
        scene.add(phone)

        const coin = makeCoin(0x3de0c4, 0.7)
        coin.position.set(1.05, 0.55, 0.65)
        scene.add(coin)

        const packets = [0, 1, 2].map((i) => {
          const packet = makePacket()
          packet.scale.setScalar(1.15)
          scene.add(packet)
          return { packet, phase: i * ((Math.PI * 2) / 3) }
        })

        return {
          update: (t) => {
            phone.rotation.x = -0.18 + Math.sin(t * 0.55) * 0.1
            phone.rotation.y = -0.42 + Math.sin(t * 0.45) * 0.35
            phone.rotation.z = 0.08 + Math.cos(t * 0.4) * 0.08
            phone.position.y = -0.15 + Math.sin(t * 0.8) * 0.16
            coin.rotation.x = t * 0.9
            coin.rotation.y = t * 0.5
            coin.position.set(1.15, 0.55 + Math.sin(t * 1.1) * 0.18, 0.75)
            for (const item of packets) {
              const a = t * 0.85 + item.phase
              item.packet.position.set(
                1.2 + Math.cos(a) * 0.55,
                0.4 + Math.sin(a * 1.4) * 0.4,
                0.75 + Math.sin(a) * 0.4,
              )
              item.packet.rotation.set(a, a * 0.6, a * 0.3)
            }
            keepOutsidePhone(phone, coin)
            for (const item of packets) keepOutsidePhone(phone, item.packet)
          },
          dispose: () => {
            disposeObject(phone)
            disposeObject(coin)
            for (const item of packets) disposeObject(item.packet)
          },
        }
      },
    })
  }, [])

  return <canvas ref={canvasRef} className="requests__video" aria-hidden="true" />
}
