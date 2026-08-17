export type ResampleKernel = 'box' | 'lanczos3'

export interface RgbaImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

// 滤波必须在预乘 alpha 的空间做，否则透明像素的 RGB（通常是 0）会渗进不透明邻居，
// 在边缘产生黑边。
function premultiply(img: RgbaImage): Float32Array {
  const out = new Float32Array(img.width * img.height * 4)
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3] / 255
    out[i] = img.data[i] * a
    out[i + 1] = img.data[i + 1] * a
    out[i + 2] = img.data[i + 2] * a
    out[i + 3] = img.data[i + 3]
  }
  return out
}

function unpremultiply(buf: Float32Array, width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < buf.length; i += 4) {
    const a = buf[i + 3] / 255
    if (a > 0) {
      data[i] = buf[i] / a
      data[i + 1] = buf[i + 1] / a
      data[i + 2] = buf[i + 2] / a
    }
    data[i + 3] = buf[i + 3]
  }
  return { width, height, data }
}

function boxResample(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const dst = new Float32Array(dw * dh * 4)
  const scaleX = sw / dw
  const scaleY = sh / dh

  for (let dy = 0; dy < dh; dy++) {
    const y0 = dy * scaleY
    const y1 = (dy + 1) * scaleY
    const iy0 = Math.floor(y0)
    const iy1 = Math.min(Math.ceil(y1), sh)

    for (let dx = 0; dx < dw; dx++) {
      const x0 = dx * scaleX
      const x1 = (dx + 1) * scaleX
      const ix0 = Math.floor(x0)
      const ix1 = Math.min(Math.ceil(x1), sw)

      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let weightSum = 0

      for (let sy = iy0; sy < iy1; sy++) {
        // 部分覆盖的源像素按重叠长度加权，这才是真正的面积平均
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0)
        if (wy <= 0) continue
        for (let sx = ix0; sx < ix1; sx++) {
          const wx = Math.min(sx + 1, x1) - Math.max(sx, x0)
          if (wx <= 0) continue
          const w = wx * wy
          const si = (sy * sw + sx) * 4
          r += src[si] * w
          g += src[si + 1] * w
          b += src[si + 2] * w
          a += src[si + 3] * w
          weightSum += w
        }
      }

      const di = (dy * dw + dx) * 4
      if (weightSum > 0) {
        dst[di] = r / weightSum
        dst[di + 1] = g / weightSum
        dst[di + 2] = b / weightSum
        dst[di + 3] = a / weightSum
      }
    }
  }
  return dst
}

function sinc(x: number): number {
  if (x === 0) return 1
  const px = Math.PI * x
  return Math.sin(px) / px
}

function lanczos(x: number, a: number): number {
  const ax = Math.abs(x)
  if (ax >= a) return 0
  return sinc(x) * sinc(x / a)
}

interface Contribution {
  start: number
  weights: Float32Array
}

function buildContributions(srcSize: number, dstSize: number, a: number): Contribution[] {
  const scale = dstSize / srcSize
  // 缩小时滤波器要在源空间展宽，否则会漏采样导致混叠
  const filterScale = scale < 1 ? 1 / scale : 1
  const support = a * filterScale
  const out: Contribution[] = []

  for (let d = 0; d < dstSize; d++) {
    const center = (d + 0.5) / scale - 0.5
    const start = Math.max(Math.ceil(center - support), 0)
    const end = Math.min(Math.floor(center + support), srcSize - 1)
    const n = Math.max(end - start + 1, 0)
    const weights = new Float32Array(n)

    let sum = 0
    for (let i = 0; i < n; i++) {
      const w = lanczos((start + i - center) / filterScale, a)
      weights[i] = w
      sum += w
    }
    if (sum !== 0) {
      for (let i = 0; i < n; i++) weights[i] /= sum
    }
    out.push({ start, weights })
  }
  return out
}

function lanczosResample(
  src: Float32Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Float32Array {
  const A = 3
  const horiz = buildContributions(sw, dw, A)
  const vert = buildContributions(sh, dh, A)

  // 两趟可分离卷积：先横后纵，O(n·a) 而非 O(n·a²)
  const tmp = new Float32Array(dw * sh * 4)
  for (let y = 0; y < sh; y++) {
    for (let dx = 0; dx < dw; dx++) {
      const { start, weights } = horiz[dx]
      let r = 0
      let g = 0
      let b = 0
      let al = 0
      for (let i = 0; i < weights.length; i++) {
        const si = (y * sw + start + i) * 4
        const w = weights[i]
        r += src[si] * w
        g += src[si + 1] * w
        b += src[si + 2] * w
        al += src[si + 3] * w
      }
      const ti = (y * dw + dx) * 4
      tmp[ti] = r
      tmp[ti + 1] = g
      tmp[ti + 2] = b
      tmp[ti + 3] = al
    }
  }

  const dst = new Float32Array(dw * dh * 4)
  for (let dy = 0; dy < dh; dy++) {
    const { start, weights } = vert[dy]
    for (let dx = 0; dx < dw; dx++) {
      let r = 0
      let g = 0
      let b = 0
      let al = 0
      for (let i = 0; i < weights.length; i++) {
        const ti = ((start + i) * dw + dx) * 4
        const w = weights[i]
        r += tmp[ti] * w
        g += tmp[ti + 1] * w
        b += tmp[ti + 2] * w
        al += tmp[ti + 3] * w
      }
      const di = (dy * dw + dx) * 4
      dst[di] = r
      dst[di + 1] = g
      dst[di + 2] = b
      dst[di + 3] = al
    }
  }
  return dst
}

// Lanczos 的负瓣会在高对比边缘产生过冲（比原图更饱和的颜色），这些不存在于原图的
// 颜色会匹配到错误的色号。用同区域的 box 结果做包络，把过冲夹回源局部范围。
function clampOvershoot(
  filtered: Float32Array,
  src: Float32Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Float32Array {
  const scaleX = sw / dw
  const scaleY = sh / dh

  for (let dy = 0; dy < dh; dy++) {
    const iy0 = Math.floor(dy * scaleY)
    const iy1 = Math.min(Math.ceil((dy + 1) * scaleY), sh)
    for (let dx = 0; dx < dw; dx++) {
      const ix0 = Math.floor(dx * scaleX)
      const ix1 = Math.min(Math.ceil((dx + 1) * scaleX), sw)

      const min = [Infinity, Infinity, Infinity, Infinity]
      const max = [-Infinity, -Infinity, -Infinity, -Infinity]
      for (let sy = iy0; sy < iy1; sy++) {
        for (let sx = ix0; sx < ix1; sx++) {
          const si = (sy * sw + sx) * 4
          for (let c = 0; c < 4; c++) {
            const v = src[si + c]
            if (v < min[c]) min[c] = v
            if (v > max[c]) max[c] = v
          }
        }
      }

      const di = (dy * dw + dx) * 4
      for (let c = 0; c < 4; c++) {
        if (min[c] === Infinity) continue
        filtered[di + c] = Math.min(Math.max(filtered[di + c], min[c]), max[c])
      }
    }
  }
  return filtered
}

export function resample(
  img: RgbaImage,
  width: number,
  height: number,
  kernel: ResampleKernel = 'box',
): RgbaImage {
  if (width <= 0 || height <= 0) {
    throw new Error(`目标尺寸必须为正数，收到 ${width}×${height}`)
  }

  const pre = premultiply(img)
  const out =
    kernel === 'lanczos3'
      ? clampOvershoot(
          lanczosResample(pre, img.width, img.height, width, height),
          pre,
          img.width,
          img.height,
          width,
          height,
        )
      : boxResample(pre, img.width, img.height, width, height)

  return unpremultiply(out, width, height)
}

// 锁定原图比例：给定一个维度算另一个，至少为 1
export function fitGrid(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
): { width: number; height: number } {
  const width = Math.max(1, Math.round(targetWidth))
  const height = Math.max(1, Math.round((width * srcHeight) / srcWidth))
  return { width, height }
}
