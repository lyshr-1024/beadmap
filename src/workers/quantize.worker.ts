import { rgbToLab, nearestColorIndex, hexToLab, type Lab } from '../lib/color'
import { resample } from '../lib/resample'
import { applyAdjustments } from '../lib/adjust'
import { EMPTY_CELL, type QuantizeRequest, type QuantizeResponse, type ColorUsage } from '../lib/quantize-types'

const aborted = new Set<number>()

/** 把每格匹配到给定色板子集，返回索引网格（相对 labs 的下标）与频次 */
function assign(
  grid: { width: number; height: number; data: Uint8ClampedArray },
  labs: Lab[],
  alphaThreshold: number,
  paletteSize: number,
  isAborted: () => boolean,
): { cells: Uint16Array; counts: Uint32Array } | null {
  const total = grid.width * grid.height
  const cells = new Uint16Array(total)
  const counts = new Uint32Array(paletteSize)

  for (let i = 0; i < total; i++) {
    // 大网格下每 4096 格回头看一次作废标记，避免白算完整轮
    if ((i & 0xfff) === 0 && isAborted()) return null
    const o = i * 4
    if (grid.data[o + 3] < alphaThreshold) {
      cells[i] = EMPTY_CELL
      continue
    }
    const lab = rgbToLab({ r: grid.data[o], g: grid.data[o + 1], b: grid.data[o + 2] })
    const idx = nearestColorIndex(lab, labs)
    cells[i] = idx
    counts[idx]++
  }
  return { cells, counts }
}

function run(req: QuantizeRequest): QuantizeResponse | null {
  const { id, width, height, buffer, palette, options } = req
  const isAborted = () => {
    if (!aborted.has(id)) return false
    aborted.delete(id)
    return true
  }
  if (isAborted()) return null

  const src = { width, height, data: new Uint8ClampedArray(buffer) }
  applyAdjustments(src, options.adjustments)

  const grid = resample(src, options.gridWidth, options.gridHeight, options.kernel)
  const labs = palette.map((c) => hexToLab(c.hex))

  const first = assign(grid, labs, options.alphaThreshold, palette.length, isAborted)
  if (!first) return null

  let cells = first.cells
  let counts = first.counts
  // 映射回完整色板的下标，限色后索引会变，但对外暴露的必须是原色板下标
  let indexMap: number[] = palette.map((_, i) => i)

  const used = counts.reduce((n, c) => n + (c > 0 ? 1 : 0), 0)
  if (options.maxColors > 0 && used > options.maxColors) {
    // 取频次 Top N 后用这个子集重新量化一遍——直接丢弃低频色会让那些格子没有归属
    const top = [...counts.keys()]
      .filter((i) => counts[i] > 0)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, options.maxColors)

    const subLabs = top.map((i) => labs[i])
    const second = assign(grid, subLabs, options.alphaThreshold, top.length, isAborted)
    if (!second) return null

    cells = second.cells
    counts = second.counts
    indexMap = top
  }

  // 索引换回完整色板下标
  if (indexMap.some((v, i) => v !== i)) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== EMPTY_CELL) cells[i] = indexMap[cells[i]]
    }
  }

  const usage: ColorUsage[] = []
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      const p = palette[indexMap[i]]
      usage.push({ index: indexMap[i], code: p.code, name: p.name, hex: p.hex, count: counts[i] })
    }
  }
  usage.sort((a, b) => b.count - a.count)

  return { id, ok: true, width: grid.width, height: grid.height, cells, usage }
}

self.onmessage = (e: MessageEvent<QuantizeRequest | { abort: number[] }>) => {
  const msg = e.data
  if ('abort' in msg) {
    for (const id of msg.abort) aborted.add(id)
    return
  }

  try {
    const res = run(msg)
    if (!res) return
    // cells 零拷贝转移回主线程
    self.postMessage(res, res.ok ? [res.cells.buffer] : [])
  } catch (err) {
    const res: QuantizeResponse = {
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(res)
  }
}
