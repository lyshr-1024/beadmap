import { useBeadStore } from '../store/useBeadStore'
import { fitGrid, type ResampleKernel } from '../lib/resample'
import { HelpTip } from './HelpTip'

const KERNELS: Array<{ id: ResampleKernel; label: string; hint: string }> = [
  { id: 'mode', label: '卡通/像素', hint: '取众数，保留纯色和描边，适合插画、表情包、像素画' },
  { id: 'box', label: '照片', hint: '面积平均，保留渐变层次，适合照片' },
  { id: 'lanczos3', label: '照片锐化', hint: '面积平均 + 锐化，细节更清晰但可能出现杂色' },
]

export function GridControls() {
  const source = useBeadStore((s) => s.source)
  const gridWidth = useBeadStore((s) => s.gridWidth)
  const kernel = useBeadStore((s) => s.kernel)
  const maxColors = useBeadStore((s) => s.maxColors)
  const setGridWidth = useBeadStore((s) => s.setGridWidth)
  const setKernel = useBeadStore((s) => s.setKernel)
  const setMaxColors = useBeadStore((s) => s.setMaxColors)

  const grid = source ? fitGrid(source.width, source.height, gridWidth) : null
  const active = KERNELS.find((k) => k.id === kernel)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-1.5">
            <label htmlFor="grid-width" className="text-xs tracking-wide text-ink-400 uppercase">
              网格宽度
            </label>
            <HelpTip>
              成品横向有多少颗豆。数字越大越清晰、越费豆子和时间。
              高度按原图比例自动算，不用管。
              <br />
              <br />
              参考：29 是一块标准洞洞板；58 需要 4 块拼接。
            </HelpTip>
          </span>
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
        <span className="flex items-center gap-1.5">
          <span className="text-xs tracking-wide text-ink-400 uppercase">图片类型</span>
          <HelpTip>
            <b className="text-ink-200">这一项对成品影响最大。</b>
            <br />
            <br />
            <b className="text-ink-300">卡通/像素</b>：每格取该区域出现最多的颜色。
            纯色块和黑描边能完整保留，色数也少。插画、表情包、像素画、logo 都选这个。
            <br />
            <br />
            <b className="text-ink-300">照片</b>：每格取该区域的平均色，保留明暗渐变，
            但会把描边混成灰、多出很多相近色号。只有真实照片才适合。
            <br />
            <br />
            <b className="text-ink-300">照片锐化</b>：照片模式加锐化，细节更清楚，
            但高对比边缘可能出现原图没有的杂色。
          </HelpTip>
        </span>
        <div className="flex gap-1.5">
          {KERNELS.map((k) => (
            <button
              key={k.id}
              type="button"
              disabled={!source}
              onClick={() => setKernel(k.id)}
              className={`flex-1 rounded border px-2 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                kernel === k.id
                  ? 'border-ink-500 bg-ink-800 text-ink-100'
                  : 'border-ink-700 text-ink-400 hover:border-ink-600'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        {active && <p className="text-xs text-ink-500">{active.hint}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-1.5">
            <label htmlFor="max-colors" className="text-xs tracking-wide text-ink-400 uppercase">
              限定色数
            </label>
            <HelpTip>
              限制最多用多少种色号。先用全色板匹配一遍统计用量，
              留下用得最多的前 N 种，再重新匹配一次。
              <br />
              <br />
              用途：买豆子省钱、减少换色麻烦。代价是颜色过渡变粗糙。
              不确定就先不限制，看用量清单里有多少色再决定。
            </HelpTip>
          </span>
          <span className="text-sm tabular-nums text-ink-300">
            {maxColors === 0 ? '不限制' : `${maxColors} 色`}
          </span>
        </div>
        <input
          id="max-colors"
          type="range"
          min={0}
          max={60}
          value={maxColors}
          disabled={!source}
          onChange={(e) => setMaxColors(Number(e.target.value))}
          className="w-full accent-ink-400 disabled:opacity-40"
        />
        <p className="text-xs text-ink-500">
          {maxColors === 0 ? '拖动可限制色号数量，买豆子更省' : '取用量最高的色号重新匹配'}
        </p>
      </div>
    </div>
  )
}
