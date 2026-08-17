import type { BeadColor } from './palette'
import type { QuantizeResult } from './quantize-types'
import { EMPTY_CELL } from './quantize-types'

export interface PrintOptions {
  cell: number
  showCodes: boolean
  showRulers: boolean
  pegBoardSize: number
  showPegSeams: boolean
}

export const DEFAULT_PRINT: PrintOptions = {
  cell: 28,
  showCodes: true,
  showRulers: true,
  pegBoardSize: 29,
  showPegSeams: true,
}

// 打印版一律白底黑字，跟屏幕上的深色 UI 无关——纸上要省墨且高对比
const PAPER = '#FFFFFF'
const INK = '#333333'
const GRID_LINE = '#CCCCCC'
const SEAM_LINE = '#666666'

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** 色块上的文字颜色跟着底色亮度翻转，否则深色珠子上的黑字看不见 */
export function contrastInk(hex: string): string {
  return luminance(hex) > 0.55 ? '#1A1A1A' : '#FFFFFF'
}

export function renderPrintable(
  result: QuantizeResult,
  colors: BeadColor[],
  opts: PrintOptions,
): HTMLCanvasElement {
  const { cell, showCodes, showRulers, pegBoardSize, showPegSeams } = opts
  const gutter = showRulers ? Math.round(cell * 0.9) : 0

  const canvas = document.createElement('canvas')
  const w = result.width * cell + gutter
  const h = result.height * cell + gutter
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建导出 canvas')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)

  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      const idx = result.cells[y * result.width + x]
      const px = gutter + x * cell
      const py = gutter + y * cell

      if (idx === EMPTY_CELL) {
        // 留空格画对角线，跟白色珠子区分开
        ctx.strokeStyle = '#E0E0E0'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px + cell, py + cell)
        ctx.stroke()
        continue
      }

      const color = colors[idx]
      if (!color) continue

      ctx.fillStyle = color.hex
      ctx.fillRect(px, py, cell, cell)

      if (showCodes && cell >= 14) {
        ctx.fillStyle = contrastInk(color.hex)
        ctx.font = `${Math.floor(cell * 0.34)}px ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(color.code, px + cell / 2, py + cell / 2)
      }
    }
  }

  ctx.strokeStyle = GRID_LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= result.width; x++) {
    const px = Math.round(gutter + x * cell) + 0.5
    ctx.moveTo(px, gutter)
    ctx.lineTo(px, h)
  }
  for (let y = 0; y <= result.height; y++) {
    const py = Math.round(gutter + y * cell) + 0.5
    ctx.moveTo(gutter, py)
    ctx.lineTo(w, py)
  }
  ctx.stroke()

  if (showPegSeams && pegBoardSize > 1) {
    ctx.strokeStyle = SEAM_LINE
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = pegBoardSize; x < result.width; x += pegBoardSize) {
      const px = Math.round(gutter + x * cell) + 0.5
      ctx.moveTo(px, gutter)
      ctx.lineTo(px, h)
    }
    for (let y = pegBoardSize; y < result.height; y += pegBoardSize) {
      const py = Math.round(gutter + y * cell) + 0.5
      ctx.moveTo(gutter, py)
      ctx.lineTo(w, py)
    }
    ctx.stroke()
  }

  if (showRulers) {
    ctx.fillStyle = INK
    ctx.font = `${Math.floor(cell * 0.4)}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let x = 0; x < result.width; x++) {
      ctx.fillText(String(x + 1), gutter + x * cell + cell / 2, gutter / 2)
    }
    ctx.textAlign = 'right'
    for (let y = 0; y < result.height; y++) {
      ctx.fillText(String(y + 1), gutter - cell * 0.2, gutter + y * cell + cell / 2)
    }
  }

  return canvas
}

export function usageToCsv(result: QuantizeResult): string {
  const total = result.usage.reduce((s, u) => s + u.count, 0)
  const rows = [
    ['色号', '名称', 'HEX', '数量', '占比'],
    ...result.usage.map((u) => [
      u.code,
      u.name,
      u.hex,
      String(u.count),
      total > 0 ? `${((u.count / total) * 100).toFixed(2)}%` : '0%',
    ]),
    [],
    ['合计', '', '', String(total), '100%'],
  ]
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

// 含逗号/引号/换行的字段要加引号，内部引号双写
function csvCell(v: string): string {
  if (v === '') return ''
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 编码失败'))), 'image/png')
  })
}

/** Excel 靠 BOM 判断 UTF-8，没有它中文列名会乱码 */
export function csvToBlob(csv: string): Blob {
  return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
}

export function baseName(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '') || 'beadmap'
}
