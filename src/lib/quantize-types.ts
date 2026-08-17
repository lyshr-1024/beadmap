import type { ResampleKernel } from './resample'
import type { BeadColor } from './palette'
import type { Adjustments } from './adjust'

export const EMPTY_CELL = 0xffff

export interface QuantizeOptions {
  gridWidth: number
  gridHeight: number
  kernel: ResampleKernel
  alphaThreshold: number
  adjustments: Adjustments
}

export interface ColorUsage {
  index: number
  code: string
  name: string
  hex: string
  count: number
}

export interface QuantizeResult {
  width: number
  height: number
  /** 每格的色板索引；EMPTY_CELL 表示透明留空 */
  cells: Uint16Array
  usage: ColorUsage[]
}

export interface QuantizeRequest {
  id: number
  width: number
  height: number
  buffer: ArrayBuffer
  palette: BeadColor[]
  options: QuantizeOptions
}

export type QuantizeResponse =
  | { id: number; ok: true; width: number; height: number; cells: Uint16Array; usage: ColorUsage[] }
  | { id: number; ok: false; error: string }
