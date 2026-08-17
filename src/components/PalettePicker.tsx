import { useState } from 'react'
import { useBeadStore, PALETTES } from '../store/useBeadStore'

export function PalettePicker() {
  const palette = useBeadStore((s) => s.palette)
  const paletteId = useBeadStore((s) => s.paletteId)
  const approximate = useBeadStore((s) => s.paletteApproximate)
  const enabled = useBeadStore((s) => s.enabledCodes)
  const setPalette = useBeadStore((s) => s.setPalette)
  const toggleColor = useBeadStore((s) => s.toggleColor)
  const setAllColors = useBeadStore((s) => s.setAllColors)
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label htmlFor="palette-select" className="block text-xs tracking-wide text-ink-400 uppercase">
          色板
        </label>
        <select
          id="palette-select"
          value={paletteId}
          onChange={(e) => setPalette(e.target.value)}
          className="w-full rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-ink-200"
        >
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.palette.brand} · {p.palette.colors.length} 色 · {p.palette.beadSize}
            </option>
          ))}
        </select>
        {approximate && (
          <p className="text-xs text-ink-500">色值为近似占位值，请勿据此购买对应色号</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-baseline justify-between text-xs tracking-wide text-ink-400 uppercase hover:text-ink-300"
      >
        <span>可用色号</span>
        <span className="text-ink-500 normal-case">
          {enabled.size}/{palette.colors.length} {open ? '收起' : '展开'}
        </span>
      </button>

      {open && (
        <div className="space-y-2">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAllColors(true)}
              className="rounded border border-ink-700 px-2 py-1 text-ink-400 hover:border-ink-600"
            >
              全选
            </button>
            <button
              type="button"
              onClick={() => setAllColors(false)}
              className="rounded border border-ink-700 px-2 py-1 text-ink-400 hover:border-ink-600"
            >
              全不选
            </button>
          </div>
          <div className="grid max-h-64 grid-cols-6 gap-1 overflow-auto pr-1">
            {palette.colors.map((c) => {
              const on = enabled.has(c.code)
              return (
                <button
                  key={c.code}
                  type="button"
                  title={`${c.code} ${c.name}`}
                  aria-pressed={on}
                  onClick={() => toggleColor(c.code)}
                  className={`aspect-square rounded-full border transition-opacity ${
                    on ? 'border-ink-400' : 'border-ink-800 opacity-25'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
