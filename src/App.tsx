import { ImageDropzone } from './components/ImageDropzone'
import { GridControls } from './components/GridControls'
import { AdjustControls } from './components/AdjustControls'
import { PalettePicker } from './components/PalettePicker'
import { ViewOptions } from './components/ViewOptions'
import { ExportPanel } from './components/ExportPanel'
import { BeadCanvas } from './components/BeadCanvas'
import { UsageList } from './components/UsageList'
import { useBeadStore } from './store/useBeadStore'

export default function App() {
  const busy = useBeadStore((s) => s.busy)
  const error = useBeadStore((s) => s.error)

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="order-2 w-full shrink-0 space-y-6 overflow-y-auto border-ink-800 border-t p-5 lg:order-1 lg:h-screen lg:w-80 lg:border-t-0 lg:border-r">
        <header className="space-y-1">
          <h1 className="font-medium text-lg">豆图 BeadMap</h1>
          <p className="text-xs text-ink-500">图片转拼豆图纸 · 全程本地处理，图片不上传</p>
        </header>

        <ImageDropzone />
        <GridControls />
        <AdjustControls />
        <ViewOptions />

        <PalettePicker />
        <ExportPanel />

        {error && <div className="rounded border border-ink-700 px-3 py-2 text-xs text-ink-300">{error}</div>}

        <UsageList />
      </aside>

      <main className="relative order-1 h-[55vh] min-w-0 shrink-0 bg-ink-900 lg:order-2 lg:h-screen lg:flex-1 lg:shrink">
        {busy && (
          <div className="absolute top-3 right-3 z-10 rounded bg-ink-800 px-2 py-1 text-xs text-ink-400">
            计算中…
          </div>
        )}
        <BeadCanvas />
      </main>
    </div>
  )
}
