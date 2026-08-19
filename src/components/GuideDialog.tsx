import { useEffect } from 'react'

const STEPS: Array<[string, string]> = [
  ['上传图片', '把图片拖进虚线框、点击选择，或直接 Ctrl/Cmd+V 粘贴。带透明背景的图，透明部分会自动留空不拼。'],
  ['选图片类型', '插画、表情包、像素画、logo 选「卡通/像素」；真实照片选「照片」。这一项对成品影响最大，选错会让描边发灰、多出一堆买不到的相近色号。'],
  ['定网格宽度', '成品横向多少颗豆。29 是一块标准洞洞板，58 需要 4 块拼接。高度按原图比例自动锁定。'],
  ['选对色板', '选你实际购买的品牌，否则图纸上的色号和手里的豆子对不上。只想用手上有的颜色，在「可用色号」里取消勾选其余色。'],
  ['核对与微调', '鼠标移到珠子上看色号；右上角可放大到逐格查看。原图偏暗或发灰时，用「图像调整」改善匹配结果。'],
  ['导出', '「打印版 PNG」是带色号的图纸，照着拼；「用量 CSV」是买豆清单。图纸过大会自动切块打包成 ZIP。'],
]

const FAQ: Array<[string, string]> = [
  [
    '导出的色号和我买的豆子不一样？',
    '先确认「色板」选的是你买的品牌。内置色值来自公开色卡交叉校验，不是厂商实测数据，与实物可能有偏差，深色和低饱和色差异更明显。',
  ],
  [
    '色号太多、买不起怎么办？',
    '拉「限定色数」滑块。它会先统计全色板匹配的用量，只留下用得最多的前 N 种再重新匹配一次，不会有格子没颜色。',
  ],
  [
    '图案边缘很脏、黑线变成灰的？',
    '「图片类型」选成了「照片」。照片模式取区域平均色，会把黑描边和邻近像素混在一起。插画类图片改选「卡通/像素」。',
  ],
  [
    '成品太大，一块洞洞板放不下？',
    '开启「洞洞板拼接缝」，虚线会标出每块板的边界，按块分别拼再拼接。导出时若图纸超过单张上限，会自动按板边界切块打包。',
  ],
  [
    '我的图片会被上传吗？',
    '不会。所有处理都在你的浏览器里完成，没有服务器参与。「复制配置链接」只保存参数，不含图片本身。',
  ],
]

export function GuideDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // 弹窗打开期间锁滚动，否则背景会跟着滚
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="使用指引"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-ink-700 bg-ink-900"
      >
        <div className="flex shrink-0 items-center justify-between border-ink-800 border-b px-4 py-3">
          <h2 className="font-medium text-ink-100">使用指引</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid size-7 place-items-center rounded border border-ink-700 text-ink-400 transition-colors hover:border-ink-500 hover:text-ink-200"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <section className="space-y-3">
            <h3 className="text-xs tracking-wide text-ink-400 uppercase">操作流程</h3>
            <ol className="space-y-3">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink-800 text-[11px] text-ink-300">
                    {i + 1}
                  </span>
                  <div className="space-y-0.5">
                    <div className="text-sm text-ink-200">{t}</div>
                    <p className="text-xs leading-relaxed text-ink-500">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs tracking-wide text-ink-400 uppercase">常见问题</h3>
            <dl className="space-y-3">
              {FAQ.map(([q, a]) => (
                <div key={q} className="space-y-0.5">
                  <dt className="text-sm text-ink-200">{q}</dt>
                  <dd className="text-xs leading-relaxed text-ink-500">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="border-ink-800 border-t pt-3 text-xs leading-relaxed text-ink-600">
            每个控件标题旁的 <span className="text-ink-400">?</span> 都能点开看该项的详细说明。
          </p>
        </div>
      </div>
    </div>
  )
}
