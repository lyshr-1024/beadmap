import { rgbToLab, nearestColorIndex, hexToLab } from '../lib/color'
import { resample } from '../lib/resample'
import { applyAdjustments } from '../lib/adjust'
import { EMPTY_CELL, type QuantizeRequest, type QuantizeResponse, type ColorUsage } from '../lib/quantize-types'

const aborted = new Set<number>()

function run(req: QuantizeRequest): QuantizeResponse | null {
  const { id, width, height, buffer, palette, options } = req
  if (aborted.has(id)) {
    aborted.delete(id)
    return null
  }

  const src = { width, height, data: new Uint8ClampedArray(buffer) }
  applyAdjustments(src, options.adjustments)

  const grid = resample(src, options.gridWidth, options.gridHeight, options.kernel)
  const labs = palette.map((c) => hexToLab(c.hex))

  const total = grid.width * grid.height
  const cells = new Uint16Array(total)
  const counts = new Uint32Array(palette.length)

  for (let i = 0; i < total; i++) {
    // 大网格下每 4096 格回头看一次作废标记，避免白算完整轮
    if ((i & 0xfff) === 0 && aborted.has(id)) {
      aborted.delete(id)
      return null
    }
    const o = i * 4
    if (grid.data[o + 3] < options.alphaThreshold) {
      cells[i] = EMPTY_CELL
      continue
    }
    const lab = rgbToLab({ r: grid.data[o], g: grid.data[o + 1], b: grid.data[o + 2] })
    const idx = nearestColorIndex(lab, labs)
    cells[i] = idx
    counts[idx]++
  }

  const usage: ColorUsage[] = []
  for (let i = 0; i < palette.length; i++) {
    if (counts[i] > 0) {
      usage.push({ index: i, code: palette[i].code, name: palette[i].name, hex: palette[i].hex, count: counts[i] })
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
