import { useEffect, useRef } from "react"
import * as THREE from "three"
import { makeCoin } from "./meshes"
import { disposeObject, startThreeLoop } from "./threeCanvas"

const COIN_COLORS = [0xe8c872, 0xd9dee6, 0x2c71f6] as const

function CoinCanvas({ color, speed }: { color: number; speed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return startThreeLoop(canvas, {
      alpha: true,
      fov: 32,
      cam: [0, 0.15, 2.15],
      lookAt: [0, 0, 0],
      dprCap: 1.25,
      setup: ({ scene }) => {
        scene.add(new THREE.AmbientLight(0xffffff, 0.7))
        const key = new THREE.DirectionalLight(0xffffff, 1.1)
        key.position.set(2, 3, 2)
        scene.add(key)
        const fill = new THREE.PointLight(0x3de0c4, 0.7, 8)
        fill.position.set(-1.5, 1, 1.5)
        scene.add(fill)
        const coin = makeCoin(color, 1)
        coin.rotation.x = 0.55
        scene.add(coin)
        return {
          update: (t) => {
            coin.rotation.y = t * speed
            coin.rotation.z = Math.sin(t * 0.7) * 0.18
            coin.position.y = Math.sin(t * 1.2) * 0.06
          },
          dispose: () => disposeObject(coin),
        }
      },
    })
  }, [color, speed])

  return <canvas ref={canvasRef} className="create__coin-canvas" aria-hidden="true" />
}

export function CreateCoins() {
  return (
    <div className="create__coins-wrapper" aria-hidden="true">
      <div className="create__coin1-wrapper">
        <div className="create__coin1">
          <CoinCanvas color={COIN_COLORS[0]} speed={0.85} />
        </div>
      </div>
      <div className="create__coin2-wrapper">
        <div className="create__coin2">
          <CoinCanvas color={COIN_COLORS[1]} speed={-0.7} />
        </div>
      </div>
      <div className="create__coin3-wrapper">
        <div className="create__coin3">
          <CoinCanvas color={COIN_COLORS[2]} speed={0.95} />
        </div>
      </div>
    </div>
  )
}
