import type { BeadColor } from './palette'
import type { QuantizeOptions, QuantizeResult, QuantizeRequest, QuantizeResponse } from './quantize-types'

export class QuantizeAborted extends Error {
  constructor() {
    super('量化请求已作废')
    this.name = 'QuantizeAborted'
  }
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: QuantizeResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/quantize.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<QuantizeResponse>) => {
    const res = e.data
    const slot = pending.get(res.id)
    if (!slot) return
    pending.delete(res.id)
    if (res.ok) {
      slot.resolve({ width: res.width, height: res.height, cells: res.cells, usage: res.usage })
    } else {
      slot.reject(new Error(res.error))
    }
  }
  worker.onerror = (e) => {
    const err = new Error(e.message || 'quantize worker 崩溃')
    for (const slot of pending.values()) slot.reject(err)
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

// 拖滑块会连发请求，旧的算完也没用。作废后既不 resolve 调用方，也让 worker 跳过还没开始的活。
export function abortPending() {
  if (pending.size === 0) return
  const ids = [...pending.keys()]
  for (const id of ids) {
    pending.get(id)?.reject(new QuantizeAborted())
    pending.delete(id)
  }
  worker?.postMessage({ abort: ids })
}

export function quantize(
  image: ImageData,
  palette: BeadColor[],
  options: QuantizeOptions,
): Promise<QuantizeResult> {
  const id = nextId++
  // 拷贝一份再转移，避免调用方持有的 ImageData 被 detach
  const buffer = image.data.slice().buffer

  const req: QuantizeRequest = {
    id,
    width: image.width,
    height: image.height,
    buffer,
    palette,
    options,
  }

  return new Promise<QuantizeResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage(req, [buffer])
  })
}
