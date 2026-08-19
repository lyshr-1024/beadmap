import { describe, it, expect } from 'vitest'
import { analyzeDetail, measureDetail, reportDetail } from './detail'
import type { RgbaImage } from './resample'

function make(width: number, height: number, fill: (x: number, y: number) => number[]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a ?? 255
    }
  }
  return { width, height, data }
}

const flat = make(400, 400, () => [180, 120, 90, 255])
// 每像素翻转：任何网格都装不下
const noise = make(400, 400, (x, y) => {
  const v = (x + y) % 2 === 0 ? 20 : 235
  return [v, v, v, 255]
})
// 100px 大色块：24 格就够表达
const blocks = make(400, 400, (x, y) => {
  const v = Math.floor(x / 100) % 2 === Math.floor(y / 100) % 2 ? 40 : 210
  return [v, v, v, 255]
})

describe('measureDetail', () => {
  it('给出各网格宽度下的损失曲线', () => {
    const m = measureDetail(blocks)
    expect(m.lossAt.length).toBeGreaterThan(3)
    expect(m.srcWidth).toBe(400)
  })

  it('损失总体随网格增大而下降', () => {
    // 逐点严格单调不成立：周期性图案在某些网格宽度上会和周期对齐，损失出现跳变。
    // 这里只要求首尾趋势下降。
    for (const img of [flat, blocks]) {
      const pts = measureDetail(img).lossAt
      expect(pts[pts.length - 1].loss).toBeLessThanOrEqual(pts[0].loss + 1e-6)
    }
  })
})

describe('reportDetail', () => {
  it('纯色图无损失、不提示', () => {
    const r = analyzeDetail(flat, 24)
    // Uint8ClampedArray 取整会留下极小残差，不是真实损失
    expect(r.loss).toBeLessThan(0.001)
    expect(r.tooCoarse).toBe(false)
  })

  it('大色块图小网格就够，不提示', () => {
    expect(analyzeDetail(blocks, 40).tooCoarse).toBe(false)
  })

  it('高频噪声图损失大', () => {
    expect(analyzeDetail(noise, 40).loss).toBeGreaterThan(0.5)
  })

  it('噪声图损失高于色块图', () => {
    expect(analyzeDetail(noise, 40).loss).toBeGreaterThan(analyzeDetail(blocks, 40).loss)
  })

  it('建议宽度总是大于当前网格（触发提示时）', () => {
    const m = measureDetail(noise)
    for (const gw of [24, 40, 58]) {
      const r = reportDetail(m, gw)
      if (r.tooCoarse) expect(r.suggestedWidth).toBeGreaterThan(gw)
    }
  })

  it('网格已足够大时不提示', () => {
    expect(reportDetail(measureDetail(blocks), 200).tooCoarse).toBe(false)
  })

  it('pixelsPerCell 反映压缩比', () => {
    expect(analyzeDetail(flat, 40).pixelsPerCell).toBe(10)
  })

  it('全透明图不崩', () => {
    const empty = make(80, 80, () => [0, 0, 0, 0])
    expect(() => analyzeDetail(empty, 20)).not.toThrow()
  })

  it('极小图不崩', () => {
    expect(() => analyzeDetail(make(2, 2, () => [1, 2, 3, 255]), 1)).not.toThrow()
  })

  it('超过探测上限时取上限的值，不再变化', () => {
    const m = measureDetail(blocks)
    const top = m.lossAt[m.lossAt.length - 1]
    expect(reportDetail(m, 500).loss).toBeCloseTo(top.loss, 6)
    expect(reportDetail(m, 5000).loss).toBeCloseTo(top.loss, 6)
  })

  it('纯色图在任何网格下都无损失', () => {
    const m = measureDetail(flat)
    for (const p of m.lossAt) expect(p.loss).toBeLessThan(0.001)
  })
})
