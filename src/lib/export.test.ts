import { describe, it, expect } from 'vitest'
import { usageToCsv, contrastInk, baseName, fitPrintCell, contentBounds } from './export'
import { EMPTY_CELL, type QuantizeResult } from './quantize-types'

function result(usage: QuantizeResult['usage']): QuantizeResult {
  return { width: 2, height: 1, cells: new Uint16Array([0, EMPTY_CELL]), usage }
}

describe('usageToCsv', () => {
  it('输出表头、数据行与合计', () => {
    const csv = usageToCsv(
      result([
        { index: 0, code: 'R04', name: '正红', hex: '#E60026', count: 30 },
        { index: 1, code: 'G01', name: '白', hex: '#FFFFFF', count: 10 },
      ]),
    )
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('色号,名称,HEX,数量,占比')
    expect(lines[1]).toBe('R04,正红,#E60026,30,75.00%')
    expect(lines[2]).toBe('G01,白,#FFFFFF,10,25.00%')
    expect(lines[4]).toBe('合计,,,40,100%')
  })

  it('占比之和为 100%', () => {
    const csv = usageToCsv(
      result([
        { index: 0, code: 'A', name: 'a', hex: '#000000', count: 1 },
        { index: 1, code: 'B', name: 'b', hex: '#FFFFFF', count: 1 },
        { index: 2, code: 'C', name: 'c', hex: '#FF0000', count: 2 },
      ]),
    )
    const pcts = [...csv.matchAll(/(\d+\.\d+)%/g)].map((m) => Number(m[1]))
    expect(pcts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1)
  })

  it('含逗号的名称被引号包裹', () => {
    const csv = usageToCsv(result([{ index: 0, code: 'X', name: '红,深', hex: '#FF0000', count: 1 }]))
    expect(csv).toContain('"红,深"')
  })

  it('含引号的名称内部引号双写', () => {
    const csv = usageToCsv(result([{ index: 0, code: 'X', name: '红"色', hex: '#FF0000', count: 1 }]))
    expect(csv).toContain('"红""色"')
  })

  it('空用量不产生 NaN 占比', () => {
    const csv = usageToCsv(result([]))
    expect(csv).not.toContain('NaN')
    expect(csv).toContain('合计,,,0,100%')
  })
})

describe('contrastInk', () => {
  it('浅底用深字', () => {
    expect(contrastInk('#FFFFFF')).toBe('#1A1A1A')
    expect(contrastInk('#FFD700')).toBe('#1A1A1A')
  })

  it('深底用浅字', () => {
    expect(contrastInk('#000000')).toBe('#FFFFFF')
    expect(contrastInk('#0059B3')).toBe('#FFFFFF')
  })

  it('用感知亮度而非平均值判断', () => {
    // 纯蓝的 RGB 平均值不低，但感知很暗，必须用白字
    expect(contrastInk('#0000FF')).toBe('#FFFFFF')
    // 纯绿平均值同样是 85，但感知很亮，该用黑字
    expect(contrastInk('#00FF00')).toBe('#1A1A1A')
  })
})

describe('baseName', () => {
  it('去掉扩展名', () => {
    expect(baseName('cat.png')).toBe('cat')
    expect(baseName('my.photo.jpeg')).toBe('my.photo')
  })

  it('无扩展名时原样返回', () => {
    expect(baseName('noext')).toBe('noext')
  })

  it('空名兜底', () => {
    expect(baseName('.png')).toBe('beadmap')
  })
})

describe('fitPrintCell', () => {
  const area = (w: number, h: number, cell: number) => {
    const g = Math.round(cell * 0.9)
    return (w * cell + g) * (h * cell + g)
  }

  it('小图纸保持期望格子尺寸', () => {
    expect(fitPrintCell(58, 58, 28)).toBe(28)
    expect(fitPrintCell(100, 100, 28)).toBe(28)
  })

  it('大图纸缩小格子而不是超限', () => {
    const cell = fitPrintCell(300, 300, 28)
    expect(cell).toBeLessThan(28)
    expect(area(300, 300, cell)).toBeLessThanOrEqual(15_000_000)
  })

  it('任意尺寸都不超过面积上限', () => {
    for (const [w, h] of [
      [58, 58],
      [150, 150],
      [200, 200],
      [400, 400],
      [400, 100],
      [40, 400],
    ]) {
      const cell = fitPrintCell(w, h, 28)
      expect(area(w, h, cell)).toBeLessThanOrEqual(15_000_000)
    }
  })

  it('极端尺寸下不低于最小格子', () => {
    expect(fitPrintCell(4000, 4000, 28)).toBe(6)
  })

  it('长条形按实际面积算而非最长边', () => {
    // 400×20 面积不大，不该被过度缩小
    expect(fitPrintCell(400, 20, 28)).toBe(28)
  })
})

describe('contentBounds', () => {
  const grid = (w: number, h: number, cells: number[]): QuantizeResult => ({
    width: w,
    height: h,
    cells: new Uint16Array(cells),
    usage: [],
  })
  const E = EMPTY_CELL

  it('无空白时返回整图', () => {
    expect(contentBounds(grid(2, 2, [0, 0, 0, 0]))).toEqual({ x: 0, y: 0, width: 2, height: 2 })
  })

  it('裁掉四周空行空列', () => {
    // 4×4，只有中间 (1,1)-(2,2) 有内容
    const g = grid(4, 4, [E, E, E, E, E, 0, 0, E, E, 0, 0, E, E, E, E, E])
    expect(contentBounds(g)).toEqual({ x: 1, y: 1, width: 2, height: 2 })
  })

  it('只裁上方空行', () => {
    const g = grid(2, 3, [E, E, 0, 0, 0, 0])
    expect(contentBounds(g)).toEqual({ x: 0, y: 1, width: 2, height: 2 })
  })

  it('只裁左侧空列', () => {
    const g = grid(3, 2, [E, 0, 0, E, 0, 0])
    expect(contentBounds(g)).toEqual({ x: 1, y: 0, width: 2, height: 2 })
  })

  it('单个珠子', () => {
    const g = grid(3, 3, [E, E, E, E, 0, E, E, E, E])
    expect(contentBounds(g)).toEqual({ x: 1, y: 1, width: 1, height: 1 })
  })

  it('全空时退回整图而非零尺寸', () => {
    const g = grid(2, 2, [E, E, E, E])
    expect(contentBounds(g)).toEqual({ x: 0, y: 0, width: 2, height: 2 })
  })

  it('内容不连续时取最外包围盒', () => {
    // 对角两个珠子，包围盒应覆盖两者
    const g = grid(3, 3, [0, E, E, E, E, E, E, E, 0])
    expect(contentBounds(g)).toEqual({ x: 0, y: 0, width: 3, height: 3 })
  })
})
