import { useBeadStore } from '../store/useBeadStore'
import { isNeutral } from '../lib/adjust'
import type { Adjustments } from '../lib/adjust'
import { HelpTip } from './HelpTip'

const FIELDS: Array<{ key: keyof Adjustments; label: string }> = [
  { key: 'brightness', label: '亮度' },
  { key: 'contrast', label: '对比度' },
  { key: 'saturation', label: '饱和度' },
]

export function AdjustControls() {
  const source = useBeadStore((s) => s.source)
  const adjustments = useBeadStore((s) => s.adjustments)
  const setAdjustment = useBeadStore((s) => s.setAdjustment)
  const reset = useBeadStore((s) => s.resetAdjustments)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-xs tracking-wide text-ink-400 uppercase">图像调整</span>
          <HelpTip>
            匹配色号<b className="text-ink-300">之前</b>先调整原图。用于原图偏暗、
            发灰、或颜色太淡导致匹配结果不理想的情况。
            <br />
            <br />
            <b className="text-ink-300">亮度</b>：整体提亮或压暗。
            <br />
            <b className="text-ink-300">对比度</b>：拉大明暗差距，让图案更分明。
            <br />
            <b className="text-ink-300">饱和度</b>：调整颜色鲜艳程度。拉到 −100 是纯灰阶，
            可以做黑白图纸。
          </HelpTip>
        </span>
        {!isNeutral(adjustments) && (
          <button type="button" onClick={reset} className="text-xs text-ink-500 hover:text-ink-300">
            重置
          </button>
        )}
      </div>
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <div className="flex items-baseline justify-between text-xs">
            <label htmlFor={`adj-${key}`} className="text-ink-400">
              {label}
            </label>
            <span className="tabular-nums text-ink-500">{adjustments[key]}</span>
          </div>
          <input
            id={`adj-${key}`}
            type="range"
            min={-100}
            max={100}
            value={adjustments[key]}
            disabled={!source}
            onChange={(e) => setAdjustment(key, Number(e.target.value))}
            className="w-full accent-ink-400 disabled:opacity-40"
          />
        </div>
      ))}
    </div>
  )
}
