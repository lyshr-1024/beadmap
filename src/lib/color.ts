export interface Lab {
  L: number
  a: number
  b: number
}

export interface Rgb {
  r: number
  g: number
  b: number
}

const D65 = { x: 95.047, y: 100, z: 108.883 }

export function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function linearToXyz({ r, g, b }: Rgb): { x: number; y: number; z: number } {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  return {
    x: (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) * 100,
    y: (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) * 100,
    z: (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) * 100,
  }
}

// CIE 标准中的 (6/29)^3 与其反函数斜率
const EPSILON = 216 / 24389
const KAPPA = 24389 / 27

function pivot(t: number): number {
  return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116
}

export function xyzToLab({ x, y, z }: { x: number; y: number; z: number }): Lab {
  const fx = pivot(x / D65.x)
  const fy = pivot(y / D65.y)
  const fz = pivot(z / D65.z)
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function rgbToLab(rgb: Rgb): Lab {
  return xyzToLab(linearToXyz(rgb))
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex))
}

const DEG = 180 / Math.PI
const RAD = Math.PI / 180

// 色相角必须归一到 [0,360)，负角度回绕是 CIEDE2000 实现最常见的错误来源
function hueAngle(a: number, b: number): number {
  if (a === 0 && b === 0) return 0
  const deg = Math.atan2(b, a) * DEG
  return deg >= 0 ? deg : deg + 360
}

export function ciede2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1
  const { L: L2, a: a2, b: b2 } = lab2

  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2

  const Cbar7 = Cbar ** 7
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)))

  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)

  const h1p = hueAngle(a1p, b1)
  const h2p = hueAngle(a2p, b2)

  const dLp = L2 - L1
  const dCp = C2p - C1p

  let dhp: number
  if (C1p * C2p === 0) {
    dhp = 0
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360
  } else {
    dhp = h2p - h1p + 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD)

  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2

  let hbarp: number
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2
  } else {
    hbarp = (h1p + h2p - 360) / 2
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * RAD) +
    0.24 * Math.cos(2 * hbarp * RAD) +
    0.32 * Math.cos((3 * hbarp + 6) * RAD) -
    0.2 * Math.cos((4 * hbarp - 63) * RAD)

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2))
  const Cbarp7 = Cbarp ** 7
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7))
  const RT = -RC * Math.sin(2 * dTheta * RAD)

  const Lbarp50 = (Lbarp - 50) ** 2
  const SL = 1 + (0.015 * Lbarp50) / Math.sqrt(20 + Lbarp50)
  const SC = 1 + 0.045 * Cbarp
  const SH = 1 + 0.015 * Cbarp * T

  const dL = dLp / SL
  const dC = dCp / SC
  const dH = dHp / SH

  return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH)
}

export function nearestColorIndex(target: Lab, palette: readonly Lab[]): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i++) {
    const d = ciede2000(target, palette[i])
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}
