import type { RgbaImage } from './resample'

export interface DetailReport {
  /** 建议的最小网格宽度 */
  suggestedWidth: number
  /** 当前网格下，每格平均吞掉多少原始像素（线性方向） */
  pixelsPerCell: number
  /** 0–1，当前网格会丢失多少信息 */
  loss: number
  /** 当前网格是否明显不足 */
  tooCoarse: boolean
  /** 即使加到探测上限仍然糊——这张图本身不适合拼豆，加格子解决不了 */
  beyondReach: boolean
  /** 按建议网格算，大约要多少颗豆 */
  suggestedBeads: number
}

export interface DetailMeasure {
  srcWidth: number
  srcHeight: number
  /** 各网格宽度下的信息损失，用于查表而不必重复扫图 */
  lossAt: Array<{ width: number; loss: number }>
}

const LUMA = [0.2126, 0.7152, 0.0722]
const PROBES = [24, 40, 58, 80, 110, 145]

/**
 * 衡量"降到 gw 格会丢多少信息"：算每格内像素亮度的标准差再取平均。
 * 格内越不一致，说明这一格塞进了本该分开的内容。
 *
 * 用格内方差而不是"格均值 vs 原像素"的误差，是因为后者对网格与图案的对齐
 * 极度敏感——同一张棋盘图，网格宽度能整除时误差为 0、不能整除时飙到 0.5，
 * 量到的是对齐伪影而非真实信息量。
 */
function lossAtWidth(
  small: { w: number; h: number; lum: Float32Array },
  gw: number,
): number {
  const { w, h, lum } = small
  if (gw >= w) return 0
  const gh = Math.max(1, Math.round((gw * h) / w))

  const n = gw * gh
  const sum = new Float64Array(n)
  const sqSum = new Float64Array(n)
  const cnt = new Float64Array(n)

  for (let y = 0; y < h; y++) {
    const gy = Math.min(gh - 1, Math.floor((y * gh) / h))
    for (let x = 0; x < w; x++) {
      const gx = Math.min(gw - 1, Math.floor((x * gw) / w))
      const k = gy * gw + gx
      const v = lum[y * w + x]
      sum[k] += v
      sqSum[k] += v * v
      cnt[k]++
    }
  }

  let total = 0
  let cells = 0
  for (let k = 0; k < n; k++) {
    if (cnt[k] < 2) continue
    const mean = sum[k] / cnt[k]
    const variance = Math.max(0, sqSum[k] / cnt[k] - mean * mean)
    total += Math.sqrt(variance)
    cells++
  }
  // 格内标准差平均 14 已属明显糊掉
  return cells === 0 ? 0 : Math.min(1, total / cells / 14)
}

// 抽样宽度要远高于最大探测网格，否则量到的是抽样对齐误差
const SAMPLE_WIDTH = 900

export function measureDetail(img: RgbaImage): DetailMeasure {
  const scale = Math.max(1, Math.round(img.width / SAMPLE_WIDTH))
  const w = Math.max(1, Math.floor(img.width / scale))
  const h = Math.max(1, Math.floor(img.height / scale))
  const lum = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y * scale) * img.width + x * scale) * 4
      lum[y * w + x] =
        LUMA[0] * img.data[i] + LUMA[1] * img.data[i + 1] + LUMA[2] * img.data[i + 2]
    }
  }
  const small = { w, h, lum }
  // 单个网格宽度的测量值会受图案周期与网格对齐的影响而跳变（合成的规则图案尤其
  // 明显）。取该宽度附近三个采样的中位数，把这种伪影压掉。
  const raw = PROBES.map((width) => {
    const vals = [width - 3, width, width + 3]
      .filter((v) => v > 1)
      .map((v) => lossAtWidth(small, v))
      .sort((a, b) => a - b)
    return { width, loss: vals[Math.floor(vals.length / 2)] }
  })

  // 损失本质上应随网格增大而下降；用前缀最小值消去残留的非单调抖动
  let floor = Infinity
  const lossAt = raw
    .slice()
    .reverse()
    .map((p) => {
      floor = Math.min(floor, p.loss)
      return { width: p.width, loss: floor }
    })
    .reverse()

  return { srcWidth: img.width, srcHeight: img.height, lossAt }
}

function interpLoss(m: DetailMeasure, gridWidth: number): number {
  const pts = m.lossAt
  if (gridWidth <= pts[0].width) return pts[0].loss
  if (gridWidth >= pts[pts.length - 1].width) return pts[pts.length - 1].loss
  for (let i = 1; i < pts.length; i++) {
    if (gridWidth <= pts[i].width) {
      const a = pts[i - 1]
      const b = pts[i]
      const t = (gridWidth - a.width) / (b.width - a.width)
      return a.loss + (b.loss - a.loss) * t
    }
  }
  return pts[pts.length - 1].loss
}

// 损失降到这个水平就算可接受
const OK_LOSS = 0.34

export function reportDetail(m: DetailMeasure, gridWidth: number): DetailReport {
  const loss = interpLoss(m, gridWidth)
  // 找到第一个把损失压到可接受范围的探测点
  const hit = m.lossAt.find((p) => p.loss <= OK_LOSS)
  const suggestedWidth = hit ? hit.width : m.lossAt[m.lossAt.length - 1].width
  const aspect = m.srcHeight / Math.max(1, m.srcWidth)

  return {
    loss,
    pixelsPerCell: m.srcWidth / Math.max(1, gridWidth),
    suggestedWidth,
    beyondReach: !hit,
    suggestedBeads: Math.round(suggestedWidth * Math.max(1, Math.round(suggestedWidth * aspect))),
    // 已经达标、或建议值并不比当前大，就不提示
    tooCoarse: loss > OK_LOSS && suggestedWidth > gridWidth * 1.15,
  }
}

export function analyzeDetail(img: RgbaImage, gridWidth: number): DetailReport {
  return reportDetail(measureDetail(img), gridWidth)
}
