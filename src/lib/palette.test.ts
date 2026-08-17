import { describe, it, expect } from 'vitest'
import { parsePalette, preparePalette } from './palette'
import generic from '../data/palettes/generic.json'
import mard from '../data/palettes/mard-221.json'

const valid = {
  brand: 'Test',
  beadSize: '5mm',
  colors: [{ code: 'T01', name: '白', hex: '#FFFFFF' }],
}

describe('parsePalette', () => {
  it('接受合法色板', () => {
    const p = parsePalette(valid)
    expect(p.brand).toBe('Test')
    expect(p.colors).toHaveLength(1)
  })

  it('接受 3 位简写 hex', () => {
    expect(() => parsePalette({ ...valid, colors: [{ code: 'A', name: 'a', hex: '#F00' }] })).not.toThrow()
  })

  it('拒绝非对象', () => {
    expect(() => parsePalette(null)).toThrow('色板必须是对象')
    expect(() => parsePalette('x')).toThrow()
  })

  it('拒绝缺失字段', () => {
    expect(() => parsePalette({ ...valid, brand: '' })).toThrow('brand')
    expect(() => parsePalette({ ...valid, beadSize: undefined })).toThrow('beadSize')
    expect(() => parsePalette({ ...valid, colors: [] })).toThrow('colors')
  })

  it('拒绝非法 hex', () => {
    expect(() => parsePalette({ ...valid, colors: [{ code: 'A', name: 'a', hex: 'FFFFFF' }] })).toThrow('hex')
    expect(() => parsePalette({ ...valid, colors: [{ code: 'A', name: 'a', hex: '#GGGGGG' }] })).toThrow('hex')
    expect(() => parsePalette({ ...valid, colors: [{ code: 'A', name: 'a', hex: '#FFFF' }] })).toThrow('hex')
  })

  it('拒绝重复色号', () => {
    expect(() =>
      parsePalette({
        ...valid,
        colors: [
          { code: 'X', name: 'a', hex: '#000000' },
          { code: 'X', name: 'b', hex: '#FFFFFF' },
        ],
      }),
    ).toThrow('重复')
  })
})

describe('generic.json', () => {
  it('通过 schema 校验', () => {
    expect(() => parsePalette(generic)).not.toThrow()
  })

  it('规模在 60 色量级', () => {
    const n = parsePalette(generic).colors.length
    expect(n).toBeGreaterThanOrEqual(55)
    expect(n).toBeLessThanOrEqual(70)
  })

  it('覆盖纯黑与纯白', () => {
    const hexes = parsePalette(generic).colors.map((c) => c.hex)
    expect(hexes).toContain('#FFFFFF')
    expect(hexes).toContain('#000000')
  })

  it('覆盖全色相环，无大于 60° 的空档', () => {
    const { colors } = parsePalette(generic)
    const hues = colors
      .map((c) => {
        const n = parseInt(c.hex.slice(1), 16)
        const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        if (max - min < 0.15) return null // 灰阶无有效色相
        const d = max - min
        let h: number
        if (max === r) h = ((g - b) / d) % 6
        else if (max === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        return ((h * 60) % 360 + 360) % 360
      })
      .filter((h): h is number => h !== null)
      .sort((a, b) => a - b)

    for (let i = 0; i < hues.length; i++) {
      const next = i === hues.length - 1 ? hues[0] + 360 : hues[i + 1]
      expect(next - hues[i]).toBeLessThanOrEqual(60)
    }
  })

  it('包含足够的灰阶层次', () => {
    const greys = parsePalette(generic).colors.filter((c) => {
      const n = parseInt(c.hex.slice(1), 16)
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      return Math.max(r, g, b) - Math.min(r, g, b) < 16
    })
    expect(greys.length).toBeGreaterThanOrEqual(6)
  })
})

describe('preparePalette', () => {
  it('为每个色号预计算 Lab', () => {
    const p = preparePalette(parsePalette(generic))
    expect(p.labs).toHaveLength(p.colors.length)
    expect(p.labs[0].L).toBeCloseTo(100, 3)
  })
})

describe('mard-221.json', () => {
  it('通过 schema 校验且为 221 色', () => {
    const p = parsePalette(mard)
    expect(p.colors).toHaveLength(221)
    expect(p.brand).toBe('Mard 221')
  })

  it('包含 A/B/C/D/E/F/G/H/M 九个系列', () => {
    const series = new Set(parsePalette(mard).colors.map((c) => c.code[0]))
    expect([...series].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'])
  })

  it('色号无重复且格式为字母+数字', () => {
    const codes = parsePalette(mard).colors.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
    codes.forEach((c) => expect(c).toMatch(/^[A-M]\d{1,2}$/))
  })

  it('覆盖足够黑与足够白（描边和高光必需）', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16)
      return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
    }
    const colors = parsePalette(mard).colors
    expect(Math.min(...colors.map((c) => lum(c.hex)))).toBeLessThan(0.02)
    expect(Math.max(...colors.map((c) => lum(c.hex)))).toBeGreaterThan(0.97)
  })
})
