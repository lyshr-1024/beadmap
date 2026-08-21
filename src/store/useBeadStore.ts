import { create } from 'zustand'
import type { BeadColor, Palette } from '../lib/palette'
import { fitGrid, type ResampleKernel } from '../lib/resample'
import { quantize, abortPending, QuantizeAborted } from '../lib/quantize'
import type { QuantizeResult } from '../lib/quantize-types'
import { NEUTRAL_ADJUSTMENTS, type Adjustments } from '../lib/adjust'
import { PALETTES, DEFAULT_PALETTE_ID, getPalette } from '../data/palettes'
import { decodeConfig, buildShareUrl, type ShareConfig } from '../lib/share'
import { measureDetail, reportDetail, type DetailReport, type DetailMeasure } from '../lib/detail'
import { FULL_CROP, isFullCrop, cropToPixels, type Crop } from '../lib/crop'

interface SourceImage {
  name: string
  /** 裁剪后的有效尺寸 */
  width: number
  height: number
  data: ImageData
  /** 细节损失曲线只跟图像有关，扫一次就够 */
  measured: DetailMeasure
  /** 原始整图，改裁剪框时从这里重新取 */
  full: ImageData
  fullWidth: number
  fullHeight: number
}

interface BeadState {
  source: SourceImage | null
  paletteId: string
  palette: Palette
  paletteApproximate: boolean
  paletteSourceNote?: string
  /** 勾选启用的色号；渲染用的索引是相对这个子集 */
  enabledCodes: Set<string>
  activeColors: BeadColor[]
  gridWidth: number
  kernel: ResampleKernel
  alphaThreshold: number
  adjustments: Adjustments
  maxColors: number
  crop: Crop
  pegBoardSize: number
  showPegSeams: boolean
  showRulers: boolean
  result: QuantizeResult | null
  /** 原图细节密度分析，用于提示网格是否够用 */
  detail: DetailReport | null
  busy: boolean
  error: string | null

  loadImage: (file: File) => Promise<void>
  setPalette: (id: string) => void
  setGridWidth: (w: number) => void
  setKernel: (k: ResampleKernel) => void
  setAdjustment: (key: keyof Adjustments, value: number) => void
  resetAdjustments: () => void
  setMaxColors: (n: number) => void
  setCrop: (c: Crop) => void
  resetCrop: () => void
  toggleColor: (code: string) => void
  setAllColors: (enabled: boolean) => void
  setPegBoardSize: (n: number) => void
  togglePegSeams: () => void
  toggleRulers: () => void
  shareUrl: () => string
}

const MAX_GRID = 400
const DEBOUNCE_MS = 80

/** 从整图里按裁剪框取出一块 */
function cutRegion(full: ImageData, crop: Crop): ImageData {
  if (isFullCrop(crop)) return full
  const r = cropToPixels(crop, full.width, full.height)
  const canvas = document.createElement('canvas')
  canvas.width = r.width
  canvas.height = r.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建 canvas 上下文')
  const src = document.createElement('canvas')
  src.width = full.width
  src.height = full.height
  const sctx = src.getContext('2d')
  if (!sctx) throw new Error('无法创建 canvas 上下文')
  sctx.putImageData(full, 0, 0)
  ctx.drawImage(src, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
  return ctx.getImageData(0, 0, r.width, r.height)
}

async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建 canvas 上下文')
  ctx.drawImage(bitmap, 0, 0)
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  return data
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const initial = decodeConfig(window.location.hash.replace(/^#/, ''), DEFAULT_PALETTE_ID)
const initialEntry = getPalette(initial.paletteId ?? DEFAULT_PALETTE_ID)
const initialDisabled = new Set(initial.disabledCodes ?? [])
const initialEnabled = new Set(
  initialEntry.palette.colors.map((c) => c.code).filter((c) => !initialDisabled.has(c)),
)

export const useBeadStore = create<BeadState>((set, get) => {
  async function compute() {
    const { source, activeColors, gridWidth, kernel, alphaThreshold, adjustments, maxColors } = get()
    if (!source) return
    if (activeColors.length === 0) {
      set({ result: null, busy: false, error: '至少勾选一个色号' })
      return
    }

    const { width, height } = fitGrid(source.width, source.height, gridWidth)
    set({ busy: true, error: null })
    try {
      const result = await quantize(source.data, activeColors, {
        gridWidth: width,
        gridHeight: height,
        kernel,
        alphaThreshold,
        adjustments,
        maxColors,
      })
      set({ result, busy: false })
    } catch (e) {
      // 作废的请求是正常调度结果，不该冒泡成错误提示
      if (e instanceof QuantizeAborted) return
      set({ error: e instanceof Error ? e.message : String(e), busy: false })
    }
  }

  // 拖滑块时连发请求没意义，作废在途的再延迟重算
  function schedule() {
    if (!get().source) return
    abortPending()
    if (debounceTimer) clearTimeout(debounceTimer)
    set({ busy: true })
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void compute()
    }, DEBOUNCE_MS)
  }

  function activeOf(palette: Palette, enabled: Set<string>) {
    return palette.colors.filter((c) => enabled.has(c.code))
  }

  return {
    source: null,
    paletteId: initialEntry.id,
    palette: initialEntry.palette,
    paletteApproximate: initialEntry.approximate,
    paletteSourceNote: initialEntry.sourceNote,
    enabledCodes: initialEnabled,
    activeColors: activeOf(initialEntry.palette, initialEnabled),
    gridWidth: initial.gridWidth ?? 58,
    kernel: initial.kernel ?? 'box',
    alphaThreshold: 128,
    adjustments: initial.adjustments ?? NEUTRAL_ADJUSTMENTS,
    maxColors: initial.maxColors ?? 0,
    crop: FULL_CROP,
    pegBoardSize: initial.pegBoardSize ?? 29,
    showPegSeams: initial.showPegSeams ?? true,
    showRulers: initial.showRulers ?? true,
    result: null,
    detail: null,
    busy: false,
    error: null,

    loadImage: async (file) => {
      set({ busy: true, error: null })
      try {
        const data = await fileToImageData(file)
        const measured = measureDetail(data)
        set({
          crop: FULL_CROP,
          source: {
            name: file.name,
            width: data.width,
            height: data.height,
            data,
            measured,
            full: data,
            fullWidth: data.width,
            fullHeight: data.height,
          },
          result: null,
          detail: reportDetail(measured, get().gridWidth),
        })
        await compute()
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), busy: false })
      }
    },

    setPalette: (id) => {
      const entry = getPalette(id)
      // 换色板等于换了一套色号，旧的勾选状态无从对应，一律全选
      const enabled = new Set(entry.palette.colors.map((c) => c.code))
      set({
        paletteId: entry.id,
        palette: entry.palette,
        paletteApproximate: entry.approximate,
        paletteSourceNote: entry.sourceNote,
        enabledCodes: enabled,
        activeColors: entry.palette.colors,
      })
      schedule()
    },

    setGridWidth: (w) => {
      const gridWidth = Math.max(1, Math.min(MAX_GRID, Math.round(w)))
      const { source } = get()
      set({
        gridWidth,
        detail: source ? reportDetail(source.measured, gridWidth) : null,
      })
      schedule()
    },

    setKernel: (kernel) => {
      set({ kernel })
      schedule()
    },

    setAdjustment: (key, value) => {
      set({ adjustments: { ...get().adjustments, [key]: Math.max(-100, Math.min(100, value)) } })
      schedule()
    },

    resetAdjustments: () => {
      set({ adjustments: NEUTRAL_ADJUSTMENTS })
      schedule()
    },

    setMaxColors: (n) => {
      set({ maxColors: Math.max(0, Math.min(221, Math.round(n))) })
      schedule()
    },

    setCrop: (crop) => {
      const { source, gridWidth } = get()
      if (!source) return
      const data = cutRegion(source.full, crop)
      const measured = measureDetail(data)
      set({
        crop,
        source: { ...source, width: data.width, height: data.height, data, measured },
        detail: reportDetail(measured, gridWidth),
      })
      schedule()
    },

    resetCrop: () => {
      const { source, gridWidth } = get()
      if (!source) return
      const measured = measureDetail(source.full)
      set({
        crop: FULL_CROP,
        source: {
          ...source,
          width: source.fullWidth,
          height: source.fullHeight,
          data: source.full,
          measured,
        },
        detail: reportDetail(measured, gridWidth),
      })
      schedule()
    },

    toggleColor: (code) => {
      const next = new Set(get().enabledCodes)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      set({ enabledCodes: next, activeColors: activeOf(get().palette, next) })
      schedule()
    },

    setAllColors: (enabled) => {
      const { palette } = get()
      const next = enabled ? new Set(palette.colors.map((c) => c.code)) : new Set<string>()
      set({ enabledCodes: next, activeColors: activeOf(palette, next) })
      schedule()
    },

    setPegBoardSize: (n) => set({ pegBoardSize: Math.max(2, Math.round(n)) }),
    togglePegSeams: () => set({ showPegSeams: !get().showPegSeams }),
    toggleRulers: () => set({ showRulers: !get().showRulers }),

    shareUrl: () => {
      const s = get()
      const cfg: ShareConfig = {
        paletteId: s.paletteId,
        gridWidth: s.gridWidth,
        kernel: s.kernel,
        adjustments: s.adjustments,
        maxColors: s.maxColors,
        pegBoardSize: s.pegBoardSize,
        showPegSeams: s.showPegSeams,
        showRulers: s.showRulers,
        disabledCodes: s.palette.colors.map((c) => c.code).filter((c) => !s.enabledCodes.has(c)),
      }
      return buildShareUrl(cfg)
    },
  }
})

export { PALETTES }
