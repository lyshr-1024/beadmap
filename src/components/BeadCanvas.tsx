import { useEffect, useRef, useState } from 'react'
import { useBeadStore } from '../store/useBeadStore'
import { EMPTY_CELL } from '../lib/quantize-types'

const BASE_CELL = 16
const MAX_CANVAS_PX = 4000
const GUTTER = 22

interface Hover {
  x: number
  y: number
  code: string
  name: string
  hex: string
}

export function BeadCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const result = useBeadStore((s) => s.result)
  const activeColors = useBeadStore((s) => s.activeColors)
  const showRulers = useBeadStore((s) => s.showRulers)
  const showPegSeams = useBeadStore((s) => s.showPegSeams)
  const pegBoardSize = useBeadStore((s) => s.pegBoardSize)
  const [hover, setHover] = useState<Hover | null>(null)

  const cellRef = useRef(BASE_CELL)
  const gutterRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !result) return

    const cell = Math.max(
      4,
      Math.min(BASE_CELL, Math.floor(MAX_CANVAS_PX / Math.max(result.width, result.height))),
    )
    const gutter = showRulers ? GUTTER : 0
    cellRef.current = cell
    gutterRef.current = gutter

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = result.width * cell + gutter
    const h = result.height * cell + gutter

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const r = cell / 2
    const outer = r * 0.92
    const hole = r * 0.3

    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const idx = result.cells[y * result.width + x]
        if (idx === EMPTY_CELL) continue
        const color = activeColors[idx]
        if (!color) continue

        const cx = gutter + x * cell + r
        const cy = gutter + y * cell + r

        // 环形珠子：外圆填色，中心孔用 even-odd 挖空
        ctx.beginPath()
        ctx.arc(cx, cy, outer, 0, Math.PI * 2)
        ctx.arc(cx, cy, hole, 0, Math.PI * 2, true)
        ctx.fillStyle = color.hex
        ctx.fill('evenodd')

        ctx.beginPath()
        ctx.arc(cx, cy, outer, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'
        ctx.lineWidth = Math.max(0.5, cell * 0.04)
        ctx.stroke()
      }
    }

    if (showPegSeams && pegBoardSize > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      for (let x = pegBoardSize; x < result.width; x += pegBoardSize) {
        const px = Math.round(gutter + x * cell) + 0.5
        ctx.moveTo(px, gutter)
        ctx.lineTo(px, h)
      }
      for (let y = pegBoardSize; y < result.height; y += pegBoardSize) {
        const py = Math.round(gutter + y * cell) + 0.5
        ctx.moveTo(gutter, py)
        ctx.lineTo(w, py)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    if (showRulers) {
      ctx.fillStyle = '#8d939b'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // 密集网格下每格标数会糊成一片，按格子像素宽度决定间隔
      const step = cell >= 14 ? 5 : cell >= 8 ? 10 : 20
      for (let x = 0; x < result.width; x++) {
        if (x % step !== 0 && x !== result.width - 1) continue
        ctx.fillText(String(x + 1), gutter + x * cell + cell / 2, gutter / 2)
      }
      ctx.textAlign = 'right'
      for (let y = 0; y < result.height; y++) {
        if (y % step !== 0 && y !== result.height - 1) continue
        ctx.fillText(String(y + 1), gutter - 5, gutter + y * cell + cell / 2)
      }
    }
  }, [result, activeColors, showRulers, showPegSeams, pegBoardSize])

  if (!result) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center text-sm text-ink-500">
        上传图片后在此预览图纸
      </div>
    )
  }

  return (
    <div className="relative overflow-auto p-4">
      <canvas
        ref={canvasRef}
        className="mx-auto block"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const cell = cellRef.current
          const gutter = gutterRef.current
          const x = Math.floor((e.clientX - rect.left - gutter) / cell)
          const y = Math.floor((e.clientY - rect.top - gutter) / cell)
          if (x < 0 || y < 0 || x >= result.width || y >= result.height) {
            setHover(null)
            return
          }
          const idx = result.cells[y * result.width + x]
          if (idx === EMPTY_CELL) {
            setHover({ x, y, code: '—', name: '留空', hex: 'transparent' })
            return
          }
          const c = activeColors[idx]
          if (!c) return
          setHover({ x, y, code: c.code, name: c.name, hex: c.hex })
        }}
      />
      {hover && (
        <div className="pointer-events-none sticky bottom-0 left-0 mt-2 flex items-center gap-2 rounded border border-ink-700 bg-ink-850 px-2 py-1 text-xs">
          <span className="tabular-nums text-ink-400">
            列 {hover.x + 1} · 行 {hover.y + 1}
          </span>
          {hover.hex !== 'transparent' && (
            <span
              className="size-3 rounded-full border border-ink-600"
              style={{ backgroundColor: hover.hex }}
            />
          )}
          <span className="font-mono text-ink-300">{hover.code}</span>
          <span className="text-ink-400">{hover.name}</span>
        </div>
      )}
    </div>
  )
}
