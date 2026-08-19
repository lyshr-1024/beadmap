import { describe, it, expect } from 'vitest'
import { fitCell, rulerGutter } from './viewfit'

const g = (show: boolean) => (cell: number) => rulerGutter(cell, show)

describe('fitCell', () => {
  it('整图在容器内不溢出', () => {
    const cases: Array<[number, number, number, number]> = [
      [900, 700, 58, 58],
      [900, 700, 200, 200],
      [390, 400, 58, 58],
      [390, 400, 155, 157],
      [1200, 900, 29, 29],
      [300, 800, 100, 40],
      [800, 300, 40, 100],
    ]
    for (const [bw, bh, gw, gh] of cases) {
      for (const rulers of [true, false]) {
        const cell = fitCell(bw, bh, gw, gh, g(rulers))
        const gut = rulerGutter(cell, rulers)
        expect(gw * cell + gut).toBeLessThanOrEqual(bw + 0.01)
        expect(gh * cell + gut).toBeLessThanOrEqual(bh + 0.01)
      }
    }
  })

  it('尽量用满容器（至少填到一边的 88%）', () => {
    const cell = fitCell(900, 700, 58, 58, g(true))
    const gut = rulerGutter(cell, true)
    const usedW = (58 * cell + gut) / 900
    const usedH = (58 * cell + gut) / 700
    expect(Math.max(usedW, usedH)).toBeGreaterThan(0.88)
  })

  it('窄容器下由宽度决定', () => {
    const cell = fitCell(300, 900, 60, 60, g(false))
    expect(60 * cell).toBeLessThanOrEqual(300)
    expect(60 * cell).toBeGreaterThan(280)
  })

  it('大网格也返回正数格子', () => {
    expect(fitCell(390, 300, 400, 400, g(true))).toBeGreaterThan(0)
  })

  it('容器为零时不崩', () => {
    expect(fitCell(0, 0, 58, 58, g(true))).toBe(1)
    expect(fitCell(-5, 100, 58, 58, g(true))).toBe(1)
  })

  it('关标尺时格子更大', () => {
    const withR = fitCell(600, 600, 50, 50, g(true))
    const noR = fitCell(600, 600, 50, 50, g(false))
    expect(noR).toBeGreaterThan(withR)
  })
})

describe('rulerGutter', () => {
  it('关闭时为 0', () => {
    expect(rulerGutter(20, false)).toBe(0)
  })

  it('小格子仍保底可读宽度', () => {
    expect(rulerGutter(1, true)).toBe(14)
  })

  it('随格子增大', () => {
    expect(rulerGutter(30, true)).toBeGreaterThan(rulerGutter(10, true))
  })
})
