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
  needsTiling,
  planTiles,
  tileFileName,
  tilesReadme,
  zipFiles,
  DEFAULT_PRINT,
} from '../lib/export'
import { HelpTip } from './HelpTip'

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
  const [progress, setProgress] = useState('')

  const disabled = !result || exporting
  const bounds = result
    ? trimEmpty
      ? contentBounds(result)
      : { x: 0, y: 0, width: result.width, height: result.height }
    : null
  const trimmed = !!result && !!bounds && (bounds.width !== result.width || bounds.height !== result.height)
  const willTile = !!bounds && needsTiling(bounds.width, bounds.height, DEFAULT_PRINT.cell)
  const tiles = bounds && willTile ? planTiles(bounds, DEFAULT_PRINT.cell, pegBoardSize) : []
  // 分块时每块都用足尺格子；单张时才按面积压缩
  const printCell = bounds
    ? willTile
      ? DEFAULT_PRINT.cell
      : fitPrintCell(bounds.width, bounds.height, DEFAULT_PRINT.cell)
    : DEFAULT_PRINT.cell

  async function exportPng() {
    if (!result || !bounds) return
    setExporting(true)
    setFailed(null)
    setProgress('')
    const opts = { ...DEFAULT_PRINT, showCodes, trimEmpty, pegBoardSize, showPegSeams }
    const stem = baseName(source?.name ?? '')
    try {
      if (!willTile) {
        const blob = await canvasToPngBlob(renderPrintable(result, activeColors, opts))
        downloadBlob(blob, `${stem}-图纸.png`)
        return
      }

      const files: Record<string, Blob> = {}
      for (const t of tiles) {
        setProgress(`生成第 ${t.n}/${tiles.length} 块…`)
        // 让出主线程，否则进度提示不会刷新
        await new Promise((r) => setTimeout(r, 0))
        const canvas = renderPrintable(result, activeColors, opts, t)
        files[tileFileName(t, tiles.length)] = await canvasToPngBlob(canvas)
      }
      files['usage.csv'] = csvToBlob(usageToCsv(result))
      files['README.txt'] = new Blob(['\ufeff' + tilesReadme(tiles, bounds, pegBoardSize)], {
        type: 'text/plain;charset=utf-8',
      })
      setProgress('打包中…')
      downloadBlob(await zipFiles(files), `${stem}-tiles-${tiles.length}.zip`)
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
      setProgress('')
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
      <span className="flex items-center gap-1.5">
        <span className="text-xs tracking-wide text-ink-400 uppercase">导出</span>
        <HelpTip>
          <b className="text-ink-300">打印版 PNG</b>：白底方格图纸，每格标着色号，
          照着拼就行。图纸太大时会自动切成多块打包成 ZIP，一块对应若干块洞洞板。
          <br />
          <br />
          <b className="text-ink-300">用量 CSV</b>：每个色号需要多少颗，
          买豆子时照着买。可以直接用 Excel 打开。
          <br />
          <br />
          <b className="text-ink-300">复制配置链接</b>：把当前参数存进链接。
          换设备或分享给别人时，打开链接后重新上传同一张图就能得到一样的结果
          （图片本身不在链接里）。
        </HelpTip>
      </span>

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
          {willTile
            ? `，超出单张上限，将切成 ${tiles.length} 块打包为 ZIP`
            : printCell < DEFAULT_PRINT.cell && '，格子已缩小以适配画布上限'}
          {!willTile && printCell < 14 && showCodes && '，格子过小将省略色号'}
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
          {exporting ? progress || '生成中…' : willTile ? `打印版 ZIP（${tiles.length} 块）` : '打印版 PNG'}
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
