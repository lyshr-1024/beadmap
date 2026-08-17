import { parsePalette, type Palette } from '../../lib/palette'
import mardJson from './mard-221.json'
import genericJson from './generic.json'
import miniJson from './mini-16.json'

export interface PaletteEntry {
  id: string
  palette: Palette
  /** 占位色板的色值是构造的近似值，不能照着买豆子 */
  approximate: boolean
  /** 色值来源与可靠性说明，UI 上展示给用户 */
  sourceNote?: string
}

// 新增品牌：丢一个 JSON 进这个目录，然后在这里加一行
export const PALETTES: PaletteEntry[] = [
  {
    id: 'mard-221',
    palette: parsePalette(mardJson),
    approximate: false,
    sourceNote: '色值取自两个公开色卡来源的交叉校验平均值，非厂商实测，与实物有偏差',
  },
  { id: 'generic', palette: parsePalette(genericJson), approximate: true },
  { id: 'mini-16', palette: parsePalette(miniJson), approximate: true },
]

export const DEFAULT_PALETTE_ID = 'mard-221'

export function getPalette(id: string): PaletteEntry {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}
