import { describe, it, expect } from 'vitest'
import { resample, fitGrid, type RgbaImage } from './resample'

function makeImage(width: number, height: number, fill: (x: number, y: number) => number[]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a
    }
  }
  return { width, height, data }
}

const solid = (r: number, g: number, b: number, a = 255) => () => [r, g, b, a]

describe('resample box', () => {
  it('均匀图缩放后颜色不变', () => {
    const src = makeImage(8, 8, solid(200, 100, 50))
    const out = resample(src, 3, 3, 'box')
    expect(out.width).toBe(3)
    expect(out.height).toBe(3)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeCloseTo(200, 0)
      expect(out.data[i + 1]).toBeCloseTo(100, 0)
      expect(out.data[i + 2]).toBeCloseTo(50, 0)
      expect(out.data[i + 3]).toBe(255)
    }
  })

  it('2×2 → 1×1 等于四点均值', () => {
    const src = makeImage(2, 2, (x, y) => {
      const v = [0, 100, 200, 255][y * 2 + x]
      return [v, v, v, 255]
    })
    const out = resample(src, 1, 1, 'box')
    const expected = (0 + 100 + 200 + 255) / 4
    expect(out.data[0]).toBeCloseTo(expected, 0)
  })

  it('非整数倍缩放按重叠面积加权', () => {
    // 3 → 2：目标像素 0 覆盖源 [0,1.5)，即源 0 全部 + 源 1 的一半
    const src = makeImage(3, 1, (x) => {
      const v = [0, 120, 240][x]
      return [v, v, v, 255]
    })
    const out = resample(src, 2, 1, 'box')
    expect(out.data[0]).toBeCloseTo(120 * 0.5 / 1.5, 0)
    expect(out.data[4]).toBeCloseTo((120 * 0.5 + 240 * 1) / 1.5, 0)
  })

  it('放大时不产生越界读取', () => {
    const src = makeImage(2, 2, solid(10, 20, 30))
    const out = resample(src, 5, 5, 'box')
    expect(out.data.length).toBe(5 * 5 * 4)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeCloseTo(10, 0)
    }
  })

  it('透明像素不把黑色渗进不透明邻居', () => {
    // 左半不透明红，右半全透明（RGB 为 0）
    const src = makeImage(2, 1, (x) => (x === 0 ? [255, 0, 0, 255] : [0, 0, 0, 0]))
    const out = resample(src, 1, 1, 'box')
    // 预乘后合成：alpha 减半，但 RGB 还原后仍是纯红
    expect(out.data[0]).toBeCloseTo(255, 0)
    expect(out.data[1]).toBeCloseTo(0, 0)
    expect(out.data[3]).toBeCloseTo(128, 0)
  })
})

describe('resample lanczos3', () => {
  it('均匀图缩放后颜色不变', () => {
    const src = makeImage(16, 16, solid(80, 160, 240))
    const out = resample(src, 4, 4, 'lanczos3')
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeCloseTo(80, 0)
      expect(out.data[i + 1]).toBeCloseTo(160, 0)
      expect(out.data[i + 2]).toBeCloseTo(240, 0)
    }
  })

  it('高对比边缘不产生超出源范围的过冲', () => {
    // 黑白竖条纹是 Lanczos 振铃最强的输入
    const src = makeImage(32, 4, (x) => {
      const v = Math.floor(x / 4) % 2 === 0 ? 0 : 255
      return [v, v, v, 255]
    })
    const out = resample(src, 8, 2, 'lanczos3')
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeGreaterThanOrEqual(0)
      expect(out.data[i]).toBeLessThanOrEqual(255)
    }
  })

  it('单色块内部不被 clamp 破坏', () => {
    const src = makeImage(12, 12, solid(123, 45, 67))
    const out = resample(src, 3, 3, 'lanczos3')
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeCloseTo(123, 0)
      expect(out.data[i + 1]).toBeCloseTo(45, 0)
      expect(out.data[i + 2]).toBeCloseTo(67, 0)
    }
  })
})

describe('resample 边界', () => {
  it('目标尺寸非正数时抛错', () => {
    const src = makeImage(4, 4, solid(1, 2, 3))
    expect(() => resample(src, 0, 4, 'box')).toThrow()
    expect(() => resample(src, 4, -1, 'box')).toThrow()
  })

  it('尺寸不变时保留原值', () => {
    const src = makeImage(4, 4, (x, y) => [x * 60, y * 60, 0, 255])
    const out = resample(src, 4, 4, 'box')
    for (let i = 0; i < src.data.length; i += 4) {
      expect(out.data[i]).toBeCloseTo(src.data[i], 0)
      expect(out.data[i + 1]).toBeCloseTo(src.data[i + 1], 0)
    }
  })
})

describe('fitGrid', () => {
  it('按原图比例算高度', () => {
    expect(fitGrid(100, 50, 40)).toEqual({ width: 40, height: 20 })
    expect(fitGrid(50, 100, 30)).toEqual({ width: 30, height: 60 })
  })

  it('正方形保持正方', () => {
    expect(fitGrid(64, 64, 29)).toEqual({ width: 29, height: 29 })
  })

  it('极端比例下高度至少为 1', () => {
    expect(fitGrid(1000, 3, 10).height).toBe(1)
  })

  it('宽度至少为 1', () => {
    expect(fitGrid(100, 100, 0).width).toBe(1)
  })
})
