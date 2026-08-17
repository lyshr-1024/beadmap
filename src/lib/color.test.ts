import { describe, it, expect } from 'vitest'
import { ciede2000, hexToRgb, hexToLab, rgbToLab, srgbToLinear, nearestColorIndex } from './color'

// Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference Formula:
// Implementation Notes, Supplementary Test Data, and Mathematical Observations",
// Table 1. 这 34 组数据专门覆盖色相角回绕和 RT 旋转项的分支边界。
const SHARMA: Array<[number, number, number, number, number, number, number]> = [
  [50.0, 2.6772, -79.7751, 50.0, 0.0, -82.7485, 2.0425],
  [50.0, 3.1571, -77.2803, 50.0, 0.0, -82.7485, 2.8615],
  [50.0, 2.8361, -74.02, 50.0, 0.0, -82.7485, 3.4412],
  [50.0, -1.3802, -84.2814, 50.0, 0.0, -82.7485, 1.0],
  [50.0, -1.1848, -84.8006, 50.0, 0.0, -82.7485, 1.0],
  [50.0, -0.9009, -85.5211, 50.0, 0.0, -82.7485, 1.0],
  [50.0, 0.0, 0.0, 50.0, -1.0, 2.0, 2.3669],
  [50.0, -1.0, 2.0, 50.0, 0.0, 0.0, 2.3669],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0009, 7.1792],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.001, 7.1792],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0011, 7.2195],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0012, 7.2195],
  [50.0, -0.001, 2.49, 50.0, 0.0009, -2.49, 4.8045],
  [50.0, -0.001, 2.49, 50.0, 0.001, -2.49, 4.8045],
  [50.0, -0.001, 2.49, 50.0, 0.0011, -2.49, 4.7461],
  [50.0, 2.5, 0.0, 50.0, 0.0, -2.5, 4.3065],
  [50.0, 2.5, 0.0, 73.0, 25.0, -18.0, 27.1492],
  [50.0, 2.5, 0.0, 61.0, -5.0, 29.0, 22.8977],
  [50.0, 2.5, 0.0, 56.0, -27.0, -3.0, 31.9030],
  [50.0, 2.5, 0.0, 58.0, 24.0, 15.0, 19.4535],
  [50.0, 2.5, 0.0, 50.0, 3.1736, 0.5854, 1.0],
  [50.0, 2.5, 0.0, 50.0, 3.2972, 0.0, 1.0],
  [50.0, 2.5, 0.0, 50.0, 1.8634, 0.5757, 1.0],
  [50.0, 2.5, 0.0, 50.0, 3.2592, 0.335, 1.0],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.263],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.248, -4.962, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
  [36.4612, 47.858, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
  [90.8027, -2.0831, 1.441, 91.1528, -1.6435, 0.0447, 1.4441],
  [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
  [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
  [2.0776, 0.0795, -1.135, 0.9033, -0.0636, -0.5514, 0.9082],
]

describe('ciede2000', () => {
  it.each(SHARMA)(
    'Lab(%f, %f, %f) vs Lab(%f, %f, %f) → dE %f',
    (L1, a1, b1, L2, a2, b2, expected) => {
      const got = ciede2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 })
      expect(got).toBeCloseTo(expected, 4)
    },
  )

  it('对称：dE(A,B) === dE(B,A)', () => {
    for (const [L1, a1, b1, L2, a2, b2] of SHARMA) {
      const ab = ciede2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 })
      const ba = ciede2000({ L: L2, a: a2, b: b2 }, { L: L1, a: a1, b: b1 })
      expect(ab).toBeCloseTo(ba, 10)
    }
  })

  it('同色距离为 0', () => {
    expect(ciede2000({ L: 50, a: 20, b: -30 }, { L: 50, a: 20, b: -30 })).toBe(0)
  })
})

describe('srgbToLinear', () => {
  it('端点映射到 0 和 1', () => {
    expect(srgbToLinear(0)).toBe(0)
    expect(srgbToLinear(255)).toBeCloseTo(1, 10)
  })

  it('线性段与幂函数段在阈值处连续', () => {
    const t = 0.04045 * 255
    expect(srgbToLinear(t - 1e-6)).toBeCloseTo(srgbToLinear(t + 1e-6), 8)
  })
})

describe('rgbToLab', () => {
  it('纯白 → L=100, a=b=0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 })
    expect(lab.L).toBeCloseTo(100, 4)
    expect(lab.a).toBeCloseTo(0, 4)
    expect(lab.b).toBeCloseTo(0, 4)
  })

  it('纯黑 → L=0', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 })
    expect(lab.L).toBeCloseTo(0, 10)
    expect(lab.a).toBeCloseTo(0, 10)
    expect(lab.b).toBeCloseTo(0, 10)
  })

  it('中灰 a/b 保持中性', () => {
    const lab = rgbToLab({ r: 128, g: 128, b: 128 })
    expect(lab.a).toBeCloseTo(0, 4)
    expect(lab.b).toBeCloseTo(0, 4)
    expect(lab.L).toBeGreaterThan(50)
    expect(lab.L).toBeLessThan(56)
  })

  it('纯红落在正 a、正 b 象限', () => {
    const lab = rgbToLab({ r: 255, g: 0, b: 0 })
    expect(lab.L).toBeCloseTo(53.2408, 3)
    expect(lab.a).toBeCloseTo(80.0925, 3)
    expect(lab.b).toBeCloseTo(67.2032, 3)
  })
})

describe('hexToRgb', () => {
  it('解析 6 位十六进制', () => {
    expect(hexToRgb('#FF8000')).toEqual({ r: 255, g: 128, b: 0 })
  })

  it('展开 3 位简写', () => {
    expect(hexToRgb('#F80')).toEqual({ r: 255, g: 136, b: 0 })
  })

  it('容忍缺省的 # 前缀', () => {
    expect(hexToRgb('00FF7F')).toEqual({ r: 0, g: 255, b: 127 })
  })
})

describe('nearestColorIndex', () => {
  const palette = [
    hexToLab('#000000'),
    hexToLab('#FFFFFF'),
    hexToLab('#FF0000'),
    hexToLab('#00FF00'),
    hexToLab('#0000FF'),
  ]

  it('精确命中返回自身', () => {
    expect(nearestColorIndex(hexToLab('#FF0000'), palette)).toBe(2)
    expect(nearestColorIndex(hexToLab('#FFFFFF'), palette)).toBe(1)
  })

  it('接近的深红匹配到红而非黑', () => {
    expect(nearestColorIndex(hexToLab('#E01010'), palette)).toBe(2)
  })

  it('暗色匹配到黑', () => {
    expect(nearestColorIndex(hexToLab('#0A0A0A'), palette)).toBe(0)
  })

  it('空色板返回 0', () => {
    expect(nearestColorIndex(hexToLab('#123456'), [])).toBe(0)
  })
})
