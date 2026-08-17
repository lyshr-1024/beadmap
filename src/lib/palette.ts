import { hexToLab, type Lab } from './color'

export interface BeadColor {
  code: string
  name: string
  hex: string
}

export interface Palette {
  brand: string
  beadSize: string
  colors: BeadColor[]
}

export interface PreparedPalette extends Palette {
  labs: Lab[]
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function parsePalette(raw: unknown): Palette {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('色板必须是对象')
  }
  const p = raw as Record<string, unknown>
  if (typeof p.brand !== 'string' || !p.brand) throw new Error('色板缺少 brand')
  if (typeof p.beadSize !== 'string' || !p.beadSize) throw new Error('色板缺少 beadSize')
  if (!Array.isArray(p.colors) || p.colors.length === 0) throw new Error('色板 colors 为空')

  const seen = new Set<string>()
  const colors = p.colors.map((c, i) => {
    if (typeof c !== 'object' || c === null) throw new Error(`colors[${i}] 不是对象`)
    const { code, name, hex } = c as Record<string, unknown>
    if (typeof code !== 'string' || !code) throw new Error(`colors[${i}] 缺少 code`)
    if (typeof name !== 'string' || !name) throw new Error(`colors[${i}] 缺少 name`)
    if (typeof hex !== 'string' || !HEX_RE.test(hex)) {
      throw new Error(`colors[${i}] (${code}) 的 hex 非法：${String(hex)}`)
    }
    if (seen.has(code)) throw new Error(`色号重复：${code}`)
    seen.add(code)
    return { code, name, hex }
  })

  return { brand: p.brand, beadSize: p.beadSize, colors }
}

// Lab 预计算一次，量化时每个格子要跟整个色板比，重复转换开销可观
export function preparePalette(palette: Palette): PreparedPalette {
  return { ...palette, labs: palette.colors.map((c) => hexToLab(c.hex)) }
}
