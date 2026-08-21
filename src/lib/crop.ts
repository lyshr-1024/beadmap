export interface Crop {
  /** 归一化 0–1，相对原图 */
  x: number
  y: number
  width: number
  height: number
}

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 }

export function isFullCrop(c: Crop): boolean {
  return c.x <= 0 && c.y <= 0 && c.width >= 1 && c.height >= 1
}

/** 夹进 [0,1] 并保证有最小可用面积 */
export function clampCrop(c: Crop, minFrac = 0.05): Crop {
  const w = Math.min(1, Math.max(minFrac, c.width))
  const h = Math.min(1, Math.max(minFrac, c.height))
  return {
    width: w,
    height: h,
    x: Math.min(1 - w, Math.max(0, c.x)),
    y: Math.min(1 - h, Math.max(0, c.y)),
  }
}

/** 归一化裁剪框换算成原图像素矩形 */
export function cropToPixels(
  c: Crop,
  srcWidth: number,
  srcHeight: number,
): { x: number; y: number; width: number; height: number } {
  const k = clampCrop(c)
  const width = Math.max(1, Math.round(k.width * srcWidth))
  const height = Math.max(1, Math.round(k.height * srcHeight))
  return {
    width,
    height,
    x: Math.min(srcWidth - width, Math.max(0, Math.round(k.x * srcWidth))),
    y: Math.min(srcHeight - height, Math.max(0, Math.round(k.y * srcHeight))),
  }
}

/** 从两个拖拽端点构造裁剪框（顺序任意） */
export function cropFromDrag(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Crop {
  return clampCrop({
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  })
}
