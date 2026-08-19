import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBeadStore } from '../store/useBeadStore'
import { EMPTY_CELL } from '../lib/quantize-types'
import { fitCell, rulerGutter } from '../lib/viewfit'

const MAX_CANVAS_PX = 4000
// 珠子小于这个尺寸就画成方块：环形的孔和描边在几个像素上只会变成噪点
const RING_MIN_CELL = 11
// 色号标注需要的最小格子尺寸
const CODE_MIN_CELL = 22

const darkCache = new Map<string, boolean>()
/** 感知亮度判断底色深浅，用来决定孔/描边/色号该用亮色还是暗色 */
function isDark(hex: string): boolean {
  let v = darkCache.get(hex)
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16)
    const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
    v = lum < 0.42
    darkCache.set(hex, v)
  }
  return v
}

interface Hover {
  x: number
  y: number
  code: string
  name: string
  hex: string
}

export function BeadCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const result = useBeadStore((s) => s.result)
  const activeColors = useBeadStore((s) => s.activeColors)
  const showRulers = useBeadStore((s) => s.showRulers)
  const showPegSeams = useBeadStore((s) => s.showPegSeams)
  const pegBoardSize = useBeadStore((s) => s.pegBoardSize)
  const [hover, setHover] = useState<Hover | null>(null)
  const [zoom, setZoom] = useState(1)
  const [box, setBox] = useState({ w: 0, h: 0 })

  const cellRef = useRef(1)
  const gutterRef = useRef(0)

  // 容器尺寸变化（窗口缩放、侧栏展开）时重算适配尺寸
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 换图或改网格后回到整图视图，否则会停在上一张图的缩放级别
  useEffect(() => {
    setZoom(1)
  }, [result?.width, result?.height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !result || box.w === 0) return

    // zoom=1 表示整图刚好铺满容器
    const gutterAt = (c: number) => rulerGutter(c, showRulers)
    const fit = fitCell(box.w, box.h, result.width, result.height, gutterAt)
    const cell = Math.min(fit * zoom, MAX_CANVAS_PX / Math.max(result.width, result.height))
    const gutter = gutterAt(cell)

    cellRef.current = cell
    gutterRef.current = gutter

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = result.width * cell + gutter
    const h = result.height * cell + gutter

    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const drawRings = cell >= RING_MIN_CELL
    const r = cell / 2
    const outer = r * 0.92
    const hole = r * 0.3

    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const idx = result.cells[y * result.width + x]
        if (idx === EMPTY_CELL) continue
        const color = activeColors[idx]
        if (!color) continue

        const px = gutter + x * cell
        const py = gutter + y * cell

        if (!drawRings) {
          // 小尺寸下铺满方块，相邻格之间不留缝，整体观感才接近原图
          ctx.fillStyle = color.hex
          ctx.fillRect(px, py, cell + 0.5, cell + 0.5)
          continue
        }

        const cx = px + r
        const cy = py + r
        // 先铺底色填满格子，珠子间不露深色背景，整体明度才接近原图
        ctx.fillStyle = color.hex
        ctx.fillRect(px, py, cell + 0.5, cell + 0.5)

        ctx.beginPath()
        ctx.arc(cx, cy, outer, 0, Math.PI * 2)
        ctx.arc(cx, cy, hole, 0, Math.PI * 2, true)
        ctx.fillStyle = color.hex
        ctx.fill('evenodd')

        // 孔和描边按底色明暗取反，否则深色珠子上的黑孔完全看不见
        const dark = isDark(color.hex)
        ctx.beginPath()
        ctx.arc(cx, cy, hole, 0, Math.PI * 2)
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(cx, cy, outer, 0, Math.PI * 2)
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
        ctx.lineWidth = Math.max(0.5, cell * 0.03)
        ctx.stroke()

        if (cell >= CODE_MIN_CELL) {
          ctx.fillStyle = dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)'
          ctx.font = `${Math.floor(cell * 0.3)}px ui-monospace, monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(color.code, cx, cy)
        }
      }
    }

    if (showPegSeams && pegBoardSize > 1 && cell >= 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      for (let x = pegBoardSize; x < result.width; x += pegBoardSize) {
        const gx = Math.round(gutter + x * cell) + 0.5
        ctx.moveTo(gx, gutter)
        ctx.lineTo(gx, h)
      }
      for (let y = pegBoardSize; y < result.height; y += pegBoardSize) {
        const gy = Math.round(gutter + y * cell) + 0.5
        ctx.moveTo(gutter, gy)
        ctx.lineTo(w, gy)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    if (showRulers) {
      ctx.fillStyle = '#8d939b'
      const fs = Math.max(7, Math.min(11, Math.floor(gutter * 0.5)))
      ctx.font = `${fs}px ui-monospace, monospace`
      ctx.textBaseline = 'middle'
      // 标号间隔按格子像素宽度定，密网格下不至于糊成一片
      const step = cell >= 26 ? 1 : cell >= 14 ? 5 : cell >= 7 ? 10 : cell >= 3 ? 20 : 50
      ctx.textAlign = 'center'
      for (let x = 0; x < result.width; x++) {
        if (x % step !== 0 && x !== result.width - 1) continue
        ctx.fillText(String(x + 1), gutter + x * cell + cell / 2, gutter / 2)
      }
      ctx.textAlign = 'right'
      for (let y = 0; y < result.height; y++) {
        if (y % step !== 0 && y !== result.height - 1) continue
        ctx.fillText(String(y + 1), gutter - 4, gutter + y * cell + cell / 2)
      }
    }
  }, [result, activeColors, showRulers, showPegSeams, pegBoardSize, box, zoom])

  const fitted = zoom === 1

  return (
    <div className="flex h-full min-h-0 flex-col">
      {result && (
        <div className="flex shrink-0 items-center gap-2 border-ink-800 border-b px-3 py-1.5">
          <span className="text-xs text-ink-500 tabular-nums">
            {result.width} × {result.height}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
              disabled={fitted}
              className="size-7 rounded border border-ink-700 text-sm text-ink-300 transition-colors hover:border-ink-500 disabled:opacity-30"
              aria-label="缩小"
            >
              −
            </button>
            <span className="w-14 text-center text-xs text-ink-400 tabular-nums">
              {fitted ? '整图' : `${zoom.toFixed(1)}×`}
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)))}
              className="size-7 rounded border border-ink-700 text-sm text-ink-300 transition-colors hover:border-ink-500"
              aria-label="放大"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div
        ref={boxRef}
        className={`min-h-0 flex-1 ${fitted ? 'overflow-hidden' : 'overflow-auto'}`}
      >
        {!result ? (
          <div className="flex h-full min-h-64 items-center justify-center p-6">
            <div className="max-w-md space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-medium text-base text-ink-200">把图片变成拼豆图纸</h2>
                <p className="text-xs leading-relaxed text-ink-500">
                  上传一张图，自动匹配到真实拼豆色号，输出可打印的图纸和每色用量。
                  图片只在你的浏览器里处理，不会上传到任何服务器。
                </p>
              </div>

              <ol className="space-y-2.5 text-xs leading-relaxed text-ink-400">
                {[
                  ['上传图片', '把图片拖进虚线框，或点击选择、Ctrl/Cmd+V 粘贴。'],
                  ['选图片类型', '插画、表情包、像素画选「卡通/像素」；真实照片选「照片」。这一项对成品影响最大。'],
                  ['定网格宽度', '决定成品有多少颗豆宽。高度按原图比例自动锁定。'],
                  ['核对色号', '鼠标移到珠子上看色号，右上角放大可逐格查看。'],
                  ['导出', '「打印版 PNG」是带色号的图纸，「用量 CSV」是买豆清单。'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-ink-800 text-[10px] text-ink-300">
                      {i + 1}
                    </span>
                    <span>
                      <b className="font-medium text-ink-300">{t}</b>
                      <span className="text-ink-500">　{d}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <p className="border-ink-800 border-t pt-3 text-xs leading-relaxed text-ink-600">
                提示：内置 Mard 221 色板，色值来自公开色卡交叉校验，与实物可能有偏差。
                只想用手上有的豆子，可在「可用色号」里取消勾选其余颜色。
              </p>
            </div>
          </div>
        ) : (
          <div className={fitted ? 'flex h-full items-center justify-center' : 'inline-block p-2'}>
            <canvas
              ref={canvasRef}
              className="block"
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
          </div>
        )}
      </div>

      {hover && (
        <div className="flex shrink-0 items-center gap-2 border-ink-800 border-t px-3 py-1.5 text-xs">
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
