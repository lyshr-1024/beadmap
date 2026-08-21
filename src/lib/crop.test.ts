import { describe, it, expect } from 'vitest'
import { clampCrop, cropToPixels, cropFromDrag, isFullCrop, FULL_CROP } from './crop'

describe('isFullCrop', () => {
  it('识别整图', () => {
    expect(isFullCrop(FULL_CROP)).toBe(true)
    expect(isFullCrop({ x: 0.1, y: 0, width: 0.9, height: 1 })).toBe(false)
  })
})

describe('clampCrop', () => {
  it('超出边界被拉回', () => {
    const c = clampCrop({ x: 0.8, y: 0.9, width: 0.5, height: 0.5 })
    expect(c.x + c.width).toBeLessThanOrEqual(1.0001)
    expect(c.y + c.height).toBeLessThanOrEqual(1.0001)
  })

  it('负坐标归零', () => {
    const c = clampCrop({ x: -0.3, y: -0.2, width: 0.5, height: 0.5 })
    expect(c.x).toBe(0)
    expect(c.y).toBe(0)
  })

  it('过小的框被撑到最小面积', () => {
    const c = clampCrop({ x: 0.5, y: 0.5, width: 0.001, height: 0.001 })
    expect(c.width).toBeGreaterThanOrEqual(0.05)
    expect(c.height).toBeGreaterThanOrEqual(0.05)
  })

  it('超过 1 的尺寸被截断', () => {
    const c = clampCrop({ x: 0, y: 0, width: 2, height: 3 })
    expect(c.width).toBe(1)
    expect(c.height).toBe(1)
  })
})

describe('cropToPixels', () => {
  it('整图返回完整尺寸', () => {
    expect(cropToPixels(FULL_CROP, 800, 600)).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it('半幅裁剪', () => {
    const r = cropToPixels({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 800, 600)
    expect(r).toEqual({ x: 200, y: 150, width: 400, height: 300 })
  })

  it('结果始终在图内', () => {
    for (const c of [
      { x: 0.99, y: 0.99, width: 0.5, height: 0.5 },
      { x: -1, y: -1, width: 0.3, height: 0.3 },
      { x: 0, y: 0, width: 5, height: 5 },
    ]) {
      const r = cropToPixels(c, 640, 480)
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.width).toBeLessThanOrEqual(640)
      expect(r.y + r.height).toBeLessThanOrEqual(480)
    }
  })

  it('尺寸至少 1 像素', () => {
    const r = cropToPixels({ x: 0, y: 0, width: 0.0001, height: 0.0001 }, 10, 10)
    expect(r.width).toBeGreaterThanOrEqual(1)
    expect(r.height).toBeGreaterThanOrEqual(1)
  })
})

describe('cropFromDrag', () => {
  it('端点顺序无关', () => {
    const a = cropFromDrag(0.2, 0.3, 0.7, 0.8)
    const b = cropFromDrag(0.7, 0.8, 0.2, 0.3)
    expect(a).toEqual(b)
  })

  it('正确计算原点与尺寸', () => {
    const c = cropFromDrag(0.2, 0.3, 0.7, 0.9)
    expect(c.x).toBeCloseTo(0.2, 5)
    expect(c.y).toBeCloseTo(0.3, 5)
    expect(c.width).toBeCloseTo(0.5, 5)
    expect(c.height).toBeCloseTo(0.6, 5)
  })

  it('点击（零尺寸）不会产生非法框', () => {
    const c = cropFromDrag(0.5, 0.5, 0.5, 0.5)
    expect(c.width).toBeGreaterThan(0)
    expect(c.height).toBeGreaterThan(0)
    expect(c.x + c.width).toBeLessThanOrEqual(1.0001)
  })
})
