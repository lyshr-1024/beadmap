import type { ResampleKernel } from './resample'
import type { Adjustments } from './adjust'
import { NEUTRAL_ADJUSTMENTS } from './adjust'

export interface ShareConfig {
  paletteId: string
  gridWidth: number
  kernel: ResampleKernel
  adjustments: Adjustments
  maxColors: number
  pegBoardSize: number
  showPegSeams: boolean
  showRulers: boolean
  /** 未勾选的色号；通常远少于勾选的，存这边 URL 更短 */
  disabledCodes: string[]
}

const KERNELS: ResampleKernel[] = ['box', 'lanczos3', 'mode']

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function encodeConfig(cfg: ShareConfig): string {
  const p = new URLSearchParams()
  p.set('p', cfg.paletteId)
  p.set('w', String(cfg.gridWidth))
  if (cfg.kernel !== 'box') p.set('k', cfg.kernel)
  const { brightness, contrast, saturation } = cfg.adjustments
  if (brightness) p.set('b', String(brightness))
  if (contrast) p.set('c', String(contrast))
  if (saturation) p.set('s', String(saturation))
  if (cfg.maxColors > 0) p.set('mc', String(cfg.maxColors))
  if (cfg.pegBoardSize !== 29) p.set('pb', String(cfg.pegBoardSize))
  if (!cfg.showPegSeams) p.set('seam', '0')
  if (!cfg.showRulers) p.set('ruler', '0')
  if (cfg.disabledCodes.length > 0) p.set('off', cfg.disabledCodes.join('.'))
  return p.toString()
}

export function decodeConfig(query: string, fallbackPaletteId: string): Partial<ShareConfig> {
  const p = new URLSearchParams(query)
  if ([...p.keys()].length === 0) return {}

  const kernelRaw = p.get('k')
  const adjustments: Adjustments = {
    brightness: clampInt(p.get('b'), -100, 100, NEUTRAL_ADJUSTMENTS.brightness),
    contrast: clampInt(p.get('c'), -100, 100, NEUTRAL_ADJUSTMENTS.contrast),
    saturation: clampInt(p.get('s'), -100, 100, NEUTRAL_ADJUSTMENTS.saturation),
  }

  return {
    paletteId: p.get('p') || fallbackPaletteId,
    gridWidth: clampInt(p.get('w'), 1, 400, 58),
    kernel: KERNELS.includes(kernelRaw as ResampleKernel) ? (kernelRaw as ResampleKernel) : 'box',
    adjustments,
    maxColors: clampInt(p.get('mc'), 0, 221, 0),
    pegBoardSize: clampInt(p.get('pb'), 2, 100, 29),
    showPegSeams: p.get('seam') !== '0',
    showRulers: p.get('ruler') !== '0',
    disabledCodes: (p.get('off') || '').split('.').filter(Boolean),
  }
}

export function buildShareUrl(cfg: ShareConfig, base = window.location.href): string {
  const url = new URL(base)
  url.search = ''
  url.hash = encodeConfig(cfg)
  return url.toString()
}
