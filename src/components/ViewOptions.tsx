import { useBeadStore } from '../store/useBeadStore'
import { HelpTip } from './HelpTip'

export function ViewOptions() {
  const showRulers = useBeadStore((s) => s.showRulers)
  const showPegSeams = useBeadStore((s) => s.showPegSeams)
  const pegBoardSize = useBeadStore((s) => s.pegBoardSize)
  const toggleRulers = useBeadStore((s) => s.toggleRulers)
  const togglePegSeams = useBeadStore((s) => s.togglePegSeams)
  const setPegBoardSize = useBeadStore((s) => s.setPegBoardSize)

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5">
        <span className="text-xs tracking-wide text-ink-400 uppercase">视图</span>
        <HelpTip>
          只影响预览和图纸的辅助线，不改变配色结果。
          <br />
          <br />
          <b className="text-ink-300">行列标尺</b>：边上的行号列号，拼的时候用来数位置。
          <br />
          <b className="text-ink-300">洞洞板拼接缝</b>：虚线标出每块板的边界。
          大图纸需要多块板拼起来，缝线能帮你分块拼。板尺寸填你手上洞洞板的格数，
          常见是 29×29。
        </HelpTip>
      </span>

      <label className="flex items-center gap-2 text-sm text-ink-300">
        <input type="checkbox" checked={showRulers} onChange={toggleRulers} className="accent-ink-400" />
        行列标尺
      </label>

      <label className="flex items-center gap-2 text-sm text-ink-300">
        <input type="checkbox" checked={showPegSeams} onChange={togglePegSeams} className="accent-ink-400" />
        洞洞板拼接缝
      </label>

      {showPegSeams && (
        <label className="flex items-center gap-2 pl-6 text-xs text-ink-400">
          板尺寸
          <input
            type="number"
            min={2}
            max={100}
            value={pegBoardSize}
            onChange={(e) => setPegBoardSize(Number(e.target.value))}
            className="w-16 rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-ink-200 tabular-nums"
          />
          格
        </label>
      )}
    </div>
  )
}
