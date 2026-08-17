import { describe, it, expect } from 'vitest'
import { encodeConfig, decodeConfig, type ShareConfig } from './share'

const base: ShareConfig = {
  paletteId: 'generic',
  gridWidth: 58,
  kernel: 'mode',
  adjustments: { brightness: 0, contrast: 0, saturation: 0 },
  maxColors: 0,
  pegBoardSize: 29,
  showPegSeams: true,
  showRulers: true,
  disabledCodes: [],
}

const roundTrip = (cfg: ShareConfig) => decodeConfig(encodeConfig(cfg), 'generic')

describe('encodeConfig', () => {
  it('默认值不写进 URL', () => {
    const q = encodeConfig(base)
    expect(q).toBe('p=generic&w=58')
  })

  it('非默认值才出现', () => {
    const q = encodeConfig({ ...base, kernel: 'lanczos3', showRulers: false })
    expect(q).toContain('k=lanczos3')
    expect(q).toContain('ruler=0')
  })

  it('未勾选色号用点分隔', () => {
    const q = encodeConfig({ ...base, disabledCodes: ['R04', 'G01'] })
    expect(q).toContain('off=R04.G01')
  })
})

describe('decodeConfig 往返', () => {
  it('默认配置往返一致', () => {
    expect(roundTrip(base)).toMatchObject({
      paletteId: 'generic',
      gridWidth: 58,
      kernel: 'mode',
      pegBoardSize: 29,
      showPegSeams: true,
      showRulers: true,
      disabledCodes: [],
    })
  })

  it('完整非默认配置往返一致', () => {
    const cfg: ShareConfig = {
      paletteId: 'mini-16',
      gridWidth: 120,
      kernel: 'lanczos3',
      adjustments: { brightness: 20, contrast: -30, saturation: 45 },
      maxColors: 18,
      pegBoardSize: 14,
      showPegSeams: false,
      showRulers: false,
      disabledCodes: ['A01', 'B02', 'C03'],
    }
    expect(roundTrip(cfg)).toMatchObject(cfg)
  })

  it('负数调整值往返保号', () => {
    const cfg = { ...base, adjustments: { brightness: -100, contrast: -1, saturation: -50 } }
    expect(roundTrip(cfg).adjustments).toEqual(cfg.adjustments)
  })
})

describe('decodeConfig 容错', () => {
  it('空查询返回空对象', () => {
    expect(decodeConfig('', 'generic')).toEqual({})
  })

  it('非默认 kernel 往返保留', () => {
    expect(roundTrip({ ...base, kernel: 'box' }).kernel).toBe('box')
    expect(roundTrip({ ...base, kernel: 'lanczos3' }).kernel).toBe('lanczos3')
  })

  it('限定色数往返一致', () => {
    expect(roundTrip({ ...base, maxColors: 18 }).maxColors).toBe(18)
  })

  it('不限色时不写进 URL', () => {
    expect(encodeConfig(base)).not.toContain('mc=')
  })

  it('未知 kernel 回落到默认', () => {
    expect(decodeConfig('p=generic&k=bogus', 'generic').kernel).toBe('mode')
  })

  it('超范围的网格宽度被夹住', () => {
    expect(decodeConfig('w=99999', 'generic').gridWidth).toBe(400)
    expect(decodeConfig('w=-5', 'generic').gridWidth).toBe(1)
  })

  it('超范围的调整值被夹住', () => {
    const a = decodeConfig('b=999&c=-999&s=abc', 'generic').adjustments
    expect(a).toEqual({ brightness: 100, contrast: -100, saturation: 0 })
  })

  it('非数字的板尺寸回落默认', () => {
    expect(decodeConfig('pb=xyz', 'generic').pegBoardSize).toBe(29)
  })

  it('缺失色板 id 用兜底值', () => {
    expect(decodeConfig('w=40', 'generic').paletteId).toBe('generic')
  })

  it('空 off 参数不产生空字符串色号', () => {
    expect(decodeConfig('p=generic&off=', 'generic').disabledCodes).toEqual([])
  })
})
