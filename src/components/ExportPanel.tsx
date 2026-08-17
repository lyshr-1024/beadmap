import { useState } from 'react'
import { useBeadStore } from '../store/useBeadStore'
import {
  renderPrintable,
  usageToCsv,
  canvasToPngBlob,
  csvToBlob,
  downloadBlob,
  baseName,
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
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  const disabled = !result || exporting

  async function exportPng() {
    if (!result) return
    setExporting(true)
    try {
      const canvas = renderPrintable(result, activeColors, {
        ...DEFAULT_PRINT,
        showCodes,
        pegBoardSize,
        showPegSeams,
      })
      const blob = await canvasToPngBlob(canvas)
      downloadBlob(blob, `${baseName(source?.name ?? '')}-图纸.png`)
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
