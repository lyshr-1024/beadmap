import { parsePalette, type Palette } from '../../lib/palette'
import genericJson from './generic.json'
import miniJson from './mini-16.json'

export interface PaletteEntry {
  id: string
  palette: Palette
  /** 占位色板的色值是构造的近似值，不能照着买豆子 */
  approximate: boolean
}

// 新增品牌：丢一个 JSON 进这个目录，然后在这里加一行
export const PALETTES: PaletteEntry[] = [
  { id: 'generic', palette: parsePalette(genericJson), approximate: true },
  { id: 'mini-16', palette: parsePalette(miniJson), approximate: true },
]

export const DEFAULT_PALETTE_ID = 'generic'

export function getPalette(id: string): PaletteEntry {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}
