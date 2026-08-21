import { useEffect, useRef, useState } from 'react'
import { useBeadStore } from '../store/useBeadStore'
import { cropFromDrag, isFullCrop } from '../lib/crop'
import { HelpTip } from './HelpTip'

function posIn(
  box: HTMLDivElement | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const r = box?.getBoundingClientRect()
  if (!r || r.width === 0) return null
  return {
    x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
  }
}

export function CropPanel() {
  const source = useBeadStore((s) => s.source)
  const crop = useBeadStore((s) => s.crop)
  const setCrop = useBeadStore((s) => s.setCrop)
  const resetCrop = useBeadStore((s) => s.resetCrop)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [drag, setDrag] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // 在 window 上收 move/up：setPointerCapture 对触摸和合成事件都不够可靠，
  // 而且拖到元素外面松手时也要能正常结束
  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      const p = posIn(boxRef.current, e.clientX, e.clientY)
      if (!p || !dragRef.current) return
      dragRef.current = { ...dragRef.current, x2: p.x, y2: p.y }
      setDrag(dragRef.current)
    }
    const up = () => {
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (d) setCrop(cropFromDrag(d.x1, d.y1, d.x2, d.y2))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag, setCrop])

  // 把原图画成缩略图作为拖框底图
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !source) return
    const maxW = 248
    const scale = Math.min(1, maxW / source.fullWidth)
    const w = Math.max(1, Math.round(source.fullWidth * scale))
    const h = Math.max(1, Math.round(source.fullHeight * scale))
    cv.width = w
    cv.height = h
    cv.style.width = `${w}px`
    cv.style.height = `${h}px`
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const tmp = document.createElement('canvas')
    tmp.width = source.fullWidth
    tmp.height = source.fullHeight
    tmp.getContext('2d')?.putImageData(source.full, 0, 0)
    ctx.drawImage(tmp, 0, 0, w, h)
  }, [source])

  const box = drag ?? {
    x1: crop.x,
    y1: crop.y,
    x2: crop.x + crop.width,
    y2: crop.y + crop.height,
  }
  const pct = (v: number) => `${v * 100}%`

  if (!source) return null



  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-xs tracking-wide text-ink-400 uppercase">裁剪</span>
          <HelpTip>
            在缩略图上拖一个框，只保留框里的部分。
            <br />
            <br />
            照片细节太多拼不清楚时，这比加大网格有效得多——同样的格子数只用来
            表达一个主体，而不是整个场景。
          </HelpTip>
        </span>
        {!isFullCrop(crop) && (
          <button type="button" onClick={resetCrop} className="text-xs text-ink-500 hover:text-ink-300">
            恢复整图
          </button>
        )}
      </div>

      <div
        ref={boxRef}
        className="relative inline-block cursor-crosshair touch-none select-none overflow-hidden rounded border border-ink-700"
        onPointerDown={(e) => {
          const p = posIn(boxRef.current, e.clientX, e.clientY)
          if (!p) return
          dragRef.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y }
          setDrag(dragRef.current)
        }}
      >
        <canvas ref={canvasRef} className="block" />
        {/* 框外压暗，框内保持原亮度 */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute border border-ink-100/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            style={{
              left: pct(Math.min(box.x1, box.x2)),
              top: pct(Math.min(box.y1, box.y2)),
              width: pct(Math.abs(box.x2 - box.x1)),
              height: pct(Math.abs(box.y2 - box.y1)),
            }}
          />
        </div>
      </div>

      <p className="text-xs text-ink-500">
        {isFullCrop(crop)
          ? '在图上拖框只保留主体'
          : `已裁剪 · ${source.width} × ${source.height} px`}
      </p>
    </div>
  )
}
