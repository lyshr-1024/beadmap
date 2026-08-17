import { describe, it, expect } from 'vitest'
import { applyAdjustments, isNeutral, NEUTRAL_ADJUSTMENTS, type Adjustments } from './adjust'
import type { RgbaImage } from './resample'

function img(pixels: number[][]): RgbaImage {
  const data = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach(([r, g, b, a], i) => {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = a ?? 255
  })
  return { width: pixels.length, height: 1, data }
}

const adj = (o: Partial<Adjustments>): Adjustments => ({ ...NEUTRAL_ADJUSTMENTS, ...o })

describe('isNeutral', () => {
  it('全零为中性', () => {
    expect(isNeutral(NEUTRAL_ADJUSTMENTS)).toBe(true)
    expect(isNeutral(adj({ brightness: 1 }))).toBe(false)
    expect(isNeutral(adj({ saturation: -5 }))).toBe(false)
  })
})

describe('brightness', () => {
  it('中性时像素不变', () => {
    const src = img([[100, 150, 200]])
    applyAdjustments(src, NEUTRAL_ADJUSTMENTS)
    expect([src.data[0], src.data[1], src.data[2]]).toEqual([100, 150, 200])
  })

  it('正值提亮，负值压暗', () => {
    const up = img([[100, 100, 100]])
    applyAdjustments(up, adj({ brightness: 20 }))
    expect(up.data[0]).toBeGreaterThan(100)

    const down = img([[100, 100, 100]])
    applyAdjustments(down, adj({ brightness: -20 }))
    expect(down.data[0]).toBeLessThan(100)
  })

  it('过曝截断到 255 而非回绕', () => {
    const src = img([[250, 250, 250]])
    applyAdjustments(src, adj({ brightness: 100 }))
    expect(src.data[0]).toBe(255)
  })

  it('过暗截断到 0', () => {
    const src = img([[5, 5, 5]])
    applyAdjustments(src, adj({ brightness: -100 }))
    expect(src.data[0]).toBe(0)
  })
})

describe('contrast', () => {
  it('提高对比度把亮的推更亮、暗的推更暗', () => {
    const src = img([
      [200, 200, 200],
      [50, 50, 50],
    ])
    applyAdjustments(src, adj({ contrast: 50 }))
    expect(src.data[0]).toBeGreaterThan(200)
    expect(src.data[4]).toBeLessThan(50)
  })

  it('中灰 128 是对比度支点，几乎不动', () => {
    const src = img([[128, 128, 128]])
    applyAdjustments(src, adj({ contrast: 80 }))
    expect(src.data[0]).toBeCloseTo(128, -1)
  })

  it('降低对比度向中灰收敛', () => {
    const src = img([[220, 220, 220]])
    applyAdjustments(src, adj({ contrast: -50 }))
    expect(src.data[0]).toBeLessThan(220)
    expect(src.data[0]).toBeGreaterThan(128)
  })
})

describe('saturation', () => {
  it('-100 完全去饱和，三通道相等', () => {
    const src = img([[200, 100, 50]])
    applyAdjustments(src, adj({ saturation: -100 }))
    expect(src.data[0]).toBe(src.data[1])
    expect(src.data[1]).toBe(src.data[2])
  })

  it('去饱和用 Rec.709 权重而非等权平均', () => {
    // 纯绿的感知亮度远高于等权平均的 85
    const src = img([[0, 255, 0]])
    applyAdjustments(src, adj({ saturation: -100 }))
    expect(src.data[0]).toBeGreaterThan(150)
  })

  it('提高饱和度拉开通道差距', () => {
    const src = img([[180, 120, 120]])
    const before = src.data[0] - src.data[1]
    applyAdjustments(src, adj({ saturation: 50 }))
    expect(src.data[0] - src.data[1]).toBeGreaterThan(before)
  })

  it('灰色提饱和仍是灰色', () => {
    const src = img([[128, 128, 128]])
    applyAdjustments(src, adj({ saturation: 100 }))
    expect(src.data[0]).toBe(src.data[1])
    expect(src.data[1]).toBe(src.data[2])
  })
})

describe('alpha 处理', () => {
  it('全透明像素跳过不处理', () => {
    const src = img([[10, 20, 30, 0]])
    applyAdjustments(src, adj({ brightness: 100 }))
    expect([src.data[0], src.data[1], src.data[2]]).toEqual([10, 20, 30])
  })

  it('alpha 通道本身不被改动', () => {
    const src = img([[100, 100, 100, 128]])
    applyAdjustments(src, adj({ brightness: 50, contrast: 50, saturation: 50 }))
    expect(src.data[3]).toBe(128)
  })
})
