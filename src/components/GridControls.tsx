import { useBeadStore } from '../store/useBeadStore'
import { fitGrid } from '../lib/resample'

export function GridControls() {
  const source = useBeadStore((s) => s.source)
  const gridWidth = useBeadStore((s) => s.gridWidth)
  const kernel = useBeadStore((s) => s.kernel)
  const setGridWidth = useBeadStore((s) => s.setGridWidth)
  const setKernel = useBeadStore((s) => s.setKernel)

  const grid = source ? fitGrid(source.width, source.height, gridWidth) : null

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="grid-width" className="text-xs tracking-wide text-ink-400 uppercase">
            网格宽度
          </label>
          <span className="text-sm tabular-nums text-ink-300">
            {grid ? `${grid.width} × ${grid.height}` : gridWidth}
          </span>
        </div>
        <input
          id="grid-width"
          type="range"
          min={8}
          max={200}
          value={gridWidth}
          disabled={!source}
          onChange={(e) => setGridWidth(Number(e.target.value))}
          className="w-full accent-ink-400 disabled:opacity-40"
        />
        <p className="text-xs text-ink-500">高度按原图比例自动锁定</p>
      </div>

      <div className="space-y-2">
        <span className="block text-xs tracking-wide text-ink-400 uppercase">采样方式</span>
        <div className="flex gap-2">
          {(['box', 'lanczos3'] as const).map((k) => (
            <button
              key={k}
              type="button"
              disabled={!source}
              onClick={() => setKernel(k)}
              className={`flex-1 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
                kernel === k
                  ? 'border-ink-500 bg-ink-800 text-ink-100'
                  : 'border-ink-700 text-ink-400 hover:border-ink-600'
              }`}
            >
              {k === 'box' ? '面积平均' : 'Lanczos'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
