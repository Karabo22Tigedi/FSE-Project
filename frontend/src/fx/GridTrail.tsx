import { useEffect, useRef } from "react"
import { prefersReducedMotion } from "./motion"

const CELL_SIZE = 40
const COLOR_R = 79
const COLOR_G = 38
const COLOR_B = 233
const STARTING_ALPHA = 200
const BACKGROUND = 31
const PROB_OF_NEIGHBOR = 0.5
const AMT_FADE_PER_FRAME = 5

type Neighbor = {
  row: number
  col: number
  opacity: number
}

function stroke(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.strokeStyle = `rgba(${COLOR_R}, ${COLOR_G}, ${COLOR_B}, ${alpha / 255})`
}

function neighborsFor(row: number, col: number, numRows: number, numCols: number): Neighbor[] {
  const next: Neighbor[] = []
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      if (dRow === 0 && dCol === 0) continue
      const neighborRow = row + dRow
      const neighborCol = col + dCol
      const inBounds =
        neighborRow >= 0 && neighborRow < numRows && neighborCol >= 0 && neighborCol < numCols
      if (inBounds && Math.random() < PROB_OF_NEIGHBOR) {
        next.push({ row: neighborRow, col: neighborCol, opacity: 255 })
      }
    }
  }
  return next
}

export function GridTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const node = canvasRef.current
    const context = node?.getContext("2d")
    if (!node || !context) return
    const canvas: HTMLCanvasElement = node
    const ctx: CanvasRenderingContext2D = context

    let width = 0
    let height = 0
    let numRows = 0
    let numCols = 0
    let currentRow = -2
    let currentCol = -2
    let mouseX = -1
    let mouseY = -1
    let allNeighbors: Neighbor[] = []
    let frame = 0

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      numRows = Math.ceil(height / CELL_SIZE)
      numCols = Math.ceil(width / CELL_SIZE)
    }

    function paintStatic() {
      ctx.fillStyle = `rgb(${BACKGROUND}, ${BACKGROUND}, ${BACKGROUND})`
      ctx.fillRect(0, 0, width, height)
    }

    function draw() {
      paintStatic()
      ctx.lineWidth = 1
      ctx.lineJoin = "miter"

      const row = Math.floor(mouseY / CELL_SIZE)
      const col = Math.floor(mouseX / CELL_SIZE)

      if (mouseX >= 0 && (row !== currentRow || col !== currentCol)) {
        currentRow = row
        currentCol = col
        allNeighbors.push(...neighborsFor(row, col, numRows, numCols))
      }

      if (mouseX >= 0) {
        stroke(ctx, STARTING_ALPHA)
        ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      }

      for (const neighbor of allNeighbors) {
        neighbor.opacity = Math.max(0, neighbor.opacity - AMT_FADE_PER_FRAME)
        stroke(ctx, neighbor.opacity)
        ctx.strokeRect(neighbor.col * CELL_SIZE, neighbor.row * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      }
      allNeighbors = allNeighbors.filter((neighbor) => neighbor.opacity > 0)

      frame = window.requestAnimationFrame(draw)
    }

    function onPointerMove(event: PointerEvent) {
      mouseX = event.clientX
      mouseY = event.clientY
    }

    function onPointerLeave(event: PointerEvent) {
      if (event.relatedTarget) return
      mouseX = -1
      mouseY = -1
      currentRow = -2
      currentCol = -2
    }

    resize()
    paintStatic()

    if (prefersReducedMotion()) {
      window.addEventListener("resize", resize)
      return () => {
        window.removeEventListener("resize", resize)
      }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    document.addEventListener("pointerleave", onPointerLeave)
    window.addEventListener("resize", resize)
    frame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerleave", onPointerLeave)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas className="grid-trail" ref={canvasRef} aria-hidden="true" />
}
