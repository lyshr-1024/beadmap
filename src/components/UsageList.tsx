import { useBeadStore } from '../store/useBeadStore'
import { HelpTip } from './HelpTip'

export function UsageList() {
  const result = useBeadStore((s) => s.result)
  if (!result || result.usage.length === 0) return null

  const total = result.usage.reduce((sum, u) => sum + u.count, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-xs tracking-wide text-ink-400 uppercase">用量清单</span>
          <HelpTip>
            每个色号要用多少颗，按用量从多到少排。买豆子前照这个清单买。
            <br />
            <br />
            色数太多不好买？拉「限定色数」滑块减少种类。
          </HelpTip>
        </span>
        <span className="text-xs text-ink-500">
          {result.usage.length} 色 · {total} 颗
        </span>
      </div>
      <ul className="max-h-80 space-y-px overflow-auto">
        {result.usage.map((u) => (
          <li key={u.code} className="flex items-center gap-2 py-1 text-sm">
            <span
              className="size-4 shrink-0 rounded-full border border-ink-700"
              style={{ backgroundColor: u.hex }}
            />
            <span className="w-10 shrink-0 font-mono text-xs text-ink-400">{u.code}</span>
            <span className="flex-1 truncate text-ink-300">{u.name}</span>
            <span className="tabular-nums text-ink-400">{u.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
