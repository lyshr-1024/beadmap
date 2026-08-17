import { useState } from 'react'
import { useBeadStore } from '../store/useBeadStore'
import {
  renderPrintable,
  usageToCsv,
  canvasToPngBlob,
  csvToBlob,
  downloadBlob,
  baseName,
  fitPrintCell,
  contentBounds,
  DEFAULT_PRINT,
} from '../lib/export'

export function ExportPanel() {
  const result = useBeadStore((s) => s.result)
  const activeColors = useBeadStore((s) => s.activeColors)
  const source = useBeadStore((s) => s.source)
  const pegBoardSize = useBeadStore((s) => s.pegBoardSize)
  const showPegSeams = useBeadStore((s) => s.showPegSeams)
  const shareUrl = useBeadStore((s) => s.shareUrl)
  const [showCodes, setShowCodes] = useState(true)
  const [trimEmpty, setTrimEmpty] = useState(true)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const disabled = !result || exporting
  const bounds = result
    ? trimEmpty
      ? contentBounds(result)
      : { x: 0, y: 0, width: result.width, height: result.height }
    : null
  const printCell = bounds ? fitPrintCell(bounds.width, bounds.height, DEFAULT_PRINT.cell) : DEFAULT_PRINT.cell
  const trimmed = !!result && !!bounds && (bounds.width !== result.width || bounds.height !== result.height)

  async function exportPng() {
    if (!result) return
    setExporting(true)
    setFailed(null)
    try {
      const canvas = renderPrintable(result, activeColors, {
        ...DEFAULT_PRINT,
        showCodes,
        trimEmpty,
        pegBoardSize,
        showPegSeams,
      })
      const blob = await canvasToPngBlob(canvas)
      downloadBlob(blob, `${baseName(source?.name ?? '')}-图纸.png`)
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  function exportCsv() {
    if (!result) return
    downloadBlob(csvToBlob(usageToCsv(result)), `${baseName(source?.name ?? '')}-用量.csv`)
  }

  async function copyShare() {
    const url = shareUrl()
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // 非安全上下文下剪贴板 API 不可用，退回到把地址栏改掉让用户自己复制
      window.location.hash = new URL(url).hash
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs tracking-wide text-ink-400 uppercase">导出</span>

      <label className="flex items-center gap-2 text-sm text-ink-300">
        <input
          type="checkbox"
          checked={showCodes}
          onChange={(e) => setShowCodes(e.target.checked)}
          className="accent-ink-400"
        />
        图纸上标注色号
      </label>

      <label className="flex items-center gap-2 text-sm text-ink-300">
        <input
          type="checkbox"
          checked={trimEmpty}
          onChange={(e) => setTrimEmpty(e.target.checked)}
          className="accent-ink-400"
        />
        裁掉四周空白
      </label>

      {result && bounds && (
        <p className="text-xs text-ink-500">
          图纸 {bounds.width} × {bounds.height} 格
          {trimmed && `（已从 ${result.width} × ${result.height} 裁剪）`}
          {printCell < DEFAULT_PRINT.cell && '，格子已缩小以适配画布上限'}
          {printCell < 14 && showCodes && '，格子过小将省略色号'}
        </p>
      )}

      {failed && (
        <p className="rounded border border-ink-700 px-2 py-1 text-xs text-ink-300">{failed}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={exportPng}
          disabled={disabled}
          className="flex-1 rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 transition-colors hover:border-ink-500 disabled:opacity-40"
        >
          {exporting ? '生成中…' : '打印版 PNG'}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={disabled}
          className="flex-1 rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 transition-colors hover:border-ink-500 disabled:opacity-40"
        >
          用量 CSV
        </button>
      </div>

      <button
        type="button"
        onClick={copyShare}
        className="w-full rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-400 transition-colors hover:border-ink-500"
      >
        {copied ? '链接已复制' : '复制配置链接'}
      </button>
    </div>
  )
}
