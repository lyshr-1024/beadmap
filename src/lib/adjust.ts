import type { RgbaImage } from './resample'

export interface Adjustments {
  /** -100 ~ 100，0 为原图 */
  brightness: number
  contrast: number
  saturation: number
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0, saturation: 0 }

export function isNeutral(a: Adjustments): boolean {
  return a.brightness === 0 && a.contrast === 0 && a.saturation === 0
}

// Rec.709 亮度权重，与人眼敏感度一致；用等权平均去饱和会让绿色显得过暗
const LUMA_R = 0.2126
const LUMA_G = 0.7152
const LUMA_B = 0.0722

/** 原地修改，调用方传的是已拷贝到 worker 的数据 */
export function applyAdjustments(img: RgbaImage, adj: Adjustments): RgbaImage {
  if (isNeutral(adj)) return img

  const brightness = (adj.brightness / 100) * 255
  // 标准对比度系数，斜率在 ±100 处趋于极值
  const c = (adj.contrast / 100) * 255
  const contrastFactor = (259 * (c + 255)) / (255 * (259 - c))
  const satFactor = 1 + adj.saturation / 100

  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue

    let r = d[i] + brightness
    let g = d[i + 1] + brightness
    let b = d[i + 2] + brightness

    r = contrastFactor * (r - 128) + 128
    g = contrastFactor * (g - 128) + 128
    b = contrastFactor * (b - 128) + 128

    if (satFactor !== 1) {
      const luma = LUMA_R * r + LUMA_G * g + LUMA_B * b
      r = luma + (r - luma) * satFactor
      g = luma + (g - luma) * satFactor
      b = luma + (b - luma) * satFactor
    }

    // Uint8ClampedArray 自带饱和截断，无需手工 clamp
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
  }
  return img
}
