import type { BeadColor } from './palette'
import type { QuantizeResult } from './quantize-types'
import { EMPTY_CELL } from './quantize-types'

export interface PrintOptions {
  cell: number
  showCodes: boolean
  showRulers: boolean
  pegBoardSize: number
  showPegSeams: boolean
  /** 裁掉四周全空的行列；透明背景的图不裁会打印出大片空白 */
  trimEmpty: boolean
}

export const DEFAULT_PRINT: PrintOptions = {
  cell: 28,
  showCodes: true,
  showRulers: true,
  pegBoardSize: 29,
  showPegSeams: true,
  trimEmpty: true,
}

// iOS Safari 的 canvas 面积上限约 16.7M 像素，超了会静默返回空白或截断的图像。
// 留 15M 余量，桌面浏览器限制更宽松但没必要区分。
const MAX_EXPORT_AREA = 15_000_000
const MIN_CELL = 6

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 找出实际有珠子的范围。透明背景的图（表情包、贴图）四周会有大片空格，
 * 原样导出等于打印一堆空白，也让人误以为图纸没导全。
 */
export function contentBounds(result: QuantizeResult): Bounds {
  let minX = result.width
  let minY = result.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      if (result.cells[y * result.width + x] === EMPTY_CELL) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  // 全空时退回整图，避免出现零尺寸画布
  if (maxX < 0) return { x: 0, y: 0, width: result.width, height: result.height }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/** 按面积上限算出安全的格子尺寸，大图纸自动缩小格子而不是导出残图 */
export function fitPrintCell(gridWidth: number, gridHeight: number, desired: number): number {
  for (let cell = Math.round(desired); cell >= MIN_CELL; cell--) {
    const gutter = Math.round(cell * 0.9)
    const w = gridWidth * cell + gutter
    const h = gridHeight * cell + gutter
    if (w * h <= MAX_EXPORT_AREA) return cell
  }
  return MIN_CELL
}

function printArea(width: number, height: number, cell: number): number {
  const gutter = Math.round(cell * 0.9)
  return (width * cell + gutter) * (height * cell + gutter)
}

/** 以期望格子尺寸导出会不会超限 */
export function needsTiling(width: number, height: number, cell: number): boolean {
  return printArea(width, height, cell) > MAX_EXPORT_AREA
}

export interface Tile extends Bounds {
  /** 从 1 开始的块序号，按行优先 */
  n: number
  col: number
  row: number
}

/**
 * 把范围切成若干块，每块都能以期望格子尺寸完整导出。
 * 切分点对齐洞洞板边界——实际拼豆是一板一板拼的，块和板对应才好用。
 */
export function planTiles(bounds: Bounds, cell: number, pegBoardSize: number): Tile[] {
  const unit = pegBoardSize > 1 ? pegBoardSize : 1
  // 从整块图开始，每次把板数上限减半，直到每块都在面积上限内
  let boardsX = Math.ceil(bounds.width / unit)
  let boardsY = Math.ceil(bounds.height / unit)

  while (boardsX > 1 || boardsY > 1) {
    const tw = Math.min(boardsX * unit, bounds.width)
    const th = Math.min(boardsY * unit, bounds.height)
    if (!needsTiling(tw, th, cell)) break
    // 先切长边，保持块尽量接近正方形
    if (boardsX >= boardsY) boardsX = Math.max(1, Math.floor(boardsX / 2))
    else boardsY = Math.max(1, Math.floor(boardsY / 2))
  }

  const stepX = Math.max(1, boardsX * unit)
  const stepY = Math.max(1, boardsY * unit)

  const tiles: Tile[] = []
  let n = 1
  for (let row = 0, y = 0; y < bounds.height; y += stepY, row++) {
    for (let col = 0, x = 0; x < bounds.width; x += stepX, col++) {
      tiles.push({
        n: n++,
        col,
        row,
        x: bounds.x + x,
        y: bounds.y + y,
        width: Math.min(stepX, bounds.width - x),
        height: Math.min(stepY, bounds.height - y),
      })
    }
    // 行内 col 计数依赖上面的循环变量，这里重置由内层声明保证
  }
  return tiles
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
  /** 只画这一块；省略时按 trimEmpty 决定画整图还是裁剪后的范围 */
  region?: Bounds,
): HTMLCanvasElement {
  const { showCodes, showRulers, pegBoardSize, showPegSeams } = opts
  const b =
    region ??
    (opts.trimEmpty
      ? contentBounds(result)
      : { x: 0, y: 0, width: result.width, height: result.height })
  // 分块时格子尺寸由调用方保证不超限，不再压缩
  const cell = region ? Math.round(opts.cell) : fitPrintCell(b.width, b.height, opts.cell)
  // 标尺要容纳最大行号的位数，否则三位数会溢出到格子里
  const digits = String(b.y + b.height).length
  const gutter = showRulers ? Math.round(cell * (0.55 + 0.28 * digits)) : 0

  const canvas = document.createElement('canvas')
  const w = b.width * cell + gutter
  const h = b.height * cell + gutter
  canvas.width = w
  canvas.height = h
  // canvas 超限时浏览器会把尺寸归零而不报错，这里显式检查
  if (canvas.width !== w || canvas.height !== h) {
    throw new Error(`图纸尺寸 ${w}×${h} 超出浏览器画布上限，请减小网格宽度`)
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建导出 canvas')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)

  for (let row = 0; row < b.height; row++) {
    for (let col = 0; col < b.width; col++) {
      const idx = result.cells[(b.y + row) * result.width + (b.x + col)]
      const px = gutter + col * cell
      const py = gutter + row * cell

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
  for (let col = 0; col <= b.width; col++) {
    const px = Math.round(gutter + col * cell) + 0.5
    ctx.moveTo(px, gutter)
    ctx.lineTo(px, h)
  }
  for (let row = 0; row <= b.height; row++) {
    const py = Math.round(gutter + row * cell) + 0.5
    ctx.moveTo(gutter, py)
    ctx.lineTo(w, py)
  }
  ctx.stroke()

  if (showPegSeams && pegBoardSize > 1) {
    // 缝线对齐原始网格原点——洞洞板的物理边界不会因为裁掉空白而移动
    ctx.strokeStyle = SEAM_LINE
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let col = 0; col <= b.width; col++) {
      if ((b.x + col) % pegBoardSize !== 0) continue
      if (col === 0 || col === b.width) continue
      const px = Math.round(gutter + col * cell) + 0.5
      ctx.moveTo(px, gutter)
      ctx.lineTo(px, h)
    }
    for (let row = 0; row <= b.height; row++) {
      if ((b.y + row) % pegBoardSize !== 0) continue
      if (row === 0 || row === b.height) continue
      const py = Math.round(gutter + row * cell) + 0.5
      ctx.moveTo(gutter, py)
      ctx.lineTo(w, py)
    }
    ctx.stroke()
  }

  if (showRulers) {
    // 标号沿用原始坐标，跟屏幕预览和 hover 读数一致
    ctx.fillStyle = INK
    ctx.font = `${Math.floor(cell * 0.4)}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let col = 0; col < b.width; col++) {
      ctx.fillText(String(b.x + col + 1), gutter + col * cell + cell / 2, gutter / 2)
    }
    ctx.textAlign = 'right'
    for (let row = 0; row < b.height; row++) {
      ctx.fillText(String(b.y + row + 1), gutter - cell * 0.2, gutter + row * cell + cell / 2)
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
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  // 立即 revoke 会让大文件在下载真正开始前失效
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
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

/**
 * 块的文件名带行列范围，拼的时候能直接对上图纸位置。
 * 只用 ASCII——ZIP 的文件名编码没有可靠的跨平台约定，中文名在 iOS 文件 App
 * 和 Windows 资源管理器里都可能乱码。可读信息放 README 里。
 */
export function tileFileName(t: Tile, total: number): string {
  const pad = String(total).length
  const seq = String(t.n).padStart(pad, '0')
  return `tile-${seq}_r${t.y + 1}-${t.y + t.height}_c${t.x + 1}-${t.x + t.width}.png`
}

/** ZIP 里的中文说明，承载文件名里塞不下的可读信息 */
export function tilesReadme(tiles: Tile[], bounds: Bounds, pegBoardSize: number): string {
  const cols = Math.max(...tiles.map((t) => t.col)) + 1
  const rows = Math.max(...tiles.map((t) => t.row)) + 1
  const lines = [
    '豆图 BeadMap 分块图纸',
    '',
    `完整图纸：${bounds.width} × ${bounds.height} 格`,
    `切分方式：${rows} 行 × ${cols} 列，共 ${tiles.length} 块`,
    `洞洞板尺寸：${pegBoardSize} 格`,
    '',
    '文件名格式：tile-序号_r起始行-结束行_c起始列-结束列.png',
    '行列号沿用完整图纸的坐标，与网页预览一致。',
    '',
    '各块范围：',
    ...tiles.map(
      (t) =>
        `  ${tileFileName(t, tiles.length)}` +
        `  →  第 ${t.row + 1} 行第 ${t.col + 1} 列块，` +
        `行 ${t.y + 1}-${t.y + t.height}，列 ${t.x + 1}-${t.x + t.width}`,
    ),
    '',
    '用量清单见 usage.csv（UTF-8 BOM，可直接用 Excel 打开）。',
  ]
  return lines.join('\r\n')
}

export async function zipFiles(files: Record<string, Blob>): Promise<Blob> {
  const { zipSync } = await import('fflate')
  const entries: Record<string, Uint8Array> = {}
  for (const [name, blob] of Object.entries(files)) {
    entries[name] = new Uint8Array(await blob.arrayBuffer())
  }
  // PNG 已是压缩格式，再 deflate 几乎没收益还很慢
  const zipped = zipSync(entries, { level: 0 })
  return new Blob([zipped as BlobPart], { type: 'application/zip' })
}

export function baseName(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '') || 'beadmap'
}
