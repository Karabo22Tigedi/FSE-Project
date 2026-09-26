import { useEffect, useRef } from "react"
import * as THREE from "three"
import { keepOutsidePhone } from "./keepOutside"
import { addStudioLights, makeCoin, makeCraft, makePacket, makePhone } from "./meshes"
import { disposeObject, startThreeLoop } from "./threeCanvas"

type LoopSceneProps = {
  className: string
  variant: "hero" | "footer"
  onReady?: () => void
}

function LoopScene({ className, variant, onReady }: LoopSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    const notify = () => onReadyRef.current?.()
    const canvas = canvasRef.current
    if (!canvas) {
      notify()
      return
    }

    const isFooter = variant === "footer"
    return startThreeLoop(canvas, {
      clearColor: 0x2c71f6,
      fov: isFooter ? 32 : 34,
      cam: isFooter ? [1.35, 1.55, 5.6] : [0.15, 1.85, 6.35],
      lookAt: isFooter ? [0.1, 0.2, 0] : [0.45, 0.2, 0],
      onReady: notify,
      setup: ({ scene }) => {
        scene.fog = new THREE.Fog(0x2c71f6, 7.5, 16)
        addStudioLights(scene)

        const phone = makePhone()
        phone.scale.setScalar(0.84)
        const phoneHome = {
          x: 1.72,
          y: 0.08,
          z: 0.28,
          rx: 0.92,
          ry: -0.48,
          rz: 0.12,
        }
        phone.position.set(phoneHome.x, phoneHome.y, phoneHome.z)
        phone.rotation.set(phoneHome.rx, phoneHome.ry, phoneHome.rz)
        scene.add(phone)

        const craft = makeCraft()
        craft.position.set(-0.2, 1.35, 0.4)
        craft.scale.setScalar(0.92)
        scene.add(craft)

        const coins = [
          { color: 0xd9dee6, pos: [-2.2, 1.3, 0.15] as const, spin: 0.7 },
          { color: 0x2c71f6, pos: [-1.95, 0.2, 1.4] as const, spin: -0.55 },
          { color: 0x3de0c4, pos: [3.2, 1.9, -1.45] as const, spin: 0.9 },
          { color: 0xe8c872, pos: [-2.05, -0.8, -0.3] as const, spin: -0.4 },
        ].map((item) => {
          const coin = makeCoin(item.color, 0.78)
          coin.position.set(item.pos[0], item.pos[1], item.pos[2])
          scene.add(coin)
          return { coin, spin: item.spin, origin: item.pos }
        })

        const packets = [0, 1, 2].map((i) => {
          const packet = makePacket()
          scene.add(packet)
          return { packet, offset: i * 2.1 }
        })

        const roots = [phone, craft, ...coins.map((c) => c.coin), ...packets.map((p) => p.packet)]

        return {
          update: (t) => {
            const drift = isFooter ? t * 0.42 : t * 0.7
            phone.position.x = phoneHome.x + Math.sin(drift * 0.55) * 0.22
            phone.position.y = phoneHome.y + Math.sin(drift) * 0.32
            phone.position.z = phoneHome.z + Math.cos(drift * 0.65) * 0.24
            phone.rotation.x = phoneHome.rx + Math.sin(drift * 0.75) * 0.22
            phone.rotation.y = phoneHome.ry + Math.sin(drift * 0.5) * 0.55
            phone.rotation.z = phoneHome.rz + Math.cos(drift * 0.6) * 0.2

            craft.position.x = (isFooter ? -0.35 : -1.35) + Math.sin(drift * 0.85) * 0.65
            craft.position.y = 1.7 + Math.sin(drift * 1.6) * 0.2
            craft.position.z = Math.cos(drift * 0.7) * 0.45
            craft.rotation.y = drift * 0.45
            craft.rotation.z = Math.sin(drift) * 0.18
            craft.rotation.x = Math.cos(drift * 0.8) * 0.12

            for (const item of coins) {
              item.coin.rotation.x = t * item.spin
              item.coin.rotation.z = t * item.spin * 0.6
              item.coin.position.set(
                item.origin[0],
                item.origin[1] + Math.sin(t * 0.9 + item.spin) * 0.16,
                item.origin[2],
              )
            }

            for (const item of packets) {
              const u = t * 0.55 + item.offset
              item.packet.position.set(
                -1.6 + Math.sin(u) * 0.75,
                0.55 + Math.cos(u * 1.3) * 0.4,
                Math.cos(u * 0.8) * 0.65,
              )
              item.packet.rotation.set(u, u * 0.7, u * 0.4)
            }

            keepOutsidePhone(phone, craft, 0.75)
            for (const item of coins) keepOutsidePhone(phone, item.coin, 0.7)
            for (const item of packets) keepOutsidePhone(phone, item.packet, 0.28)
          },
          dispose: () => {
            for (const root of roots) {
              scene.remove(root)
              disposeObject(root)
            }
          },
        }
      },
    })
  }, [variant])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

type HeroSceneProps = {
  onReady?: () => void
}

export function HeroScene({ onReady }: HeroSceneProps) {
  return (
    <div className="hero__videos-wrapper">
      <LoopScene className="hero__loop" variant="hero" onReady={onReady} />
    </div>
  )
}

export function FooterScene() {
  return (
    <div className="footer__loop-wrapper">
      <LoopScene className="footer__loop" variant="footer" />
    </div>
  )
}
