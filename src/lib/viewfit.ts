/** 预览区可用空间与网格尺寸，算出 zoom=1（整图铺满）时的格子边长 */
export function fitCell(
  boxWidth: number,
  boxHeight: number,
  gridWidth: number,
  gridHeight: number,
  gutterOf: (cell: number) => number,
  pad = 8,
): number {
  if (boxWidth <= 0 || boxHeight <= 0 || gridWidth <= 0 || gridHeight <= 0) return 1
  // gutter 依赖 cell、cell 又依赖 gutter，迭代几轮就收敛
  let cell = Math.min(boxWidth / gridWidth, boxHeight / gridHeight)
  for (let i = 0; i < 4; i++) {
    const g = gutterOf(cell)
    cell = Math.min((boxWidth - g - pad) / gridWidth, (boxHeight - g - pad) / gridHeight)
    if (cell <= 0) return Math.max(0.5, Math.min(boxWidth / gridWidth, boxHeight / gridHeight) / 4)
  }
  return Math.max(0.5, cell)
}

export function rulerGutter(cell: number, show: boolean): number {
  return show ? Math.max(14, Math.round(cell * 1.6)) : 0
}
