import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeadStore } from '../store/useBeadStore'

export function ImageDropzone() {
  const loadImage = useBeadStore((s) => s.loadImage)
  const source = useBeadStore((s) => s.source)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = useCallback(
    (files: FileList | null) => {
      const file = Array.from(files ?? []).find((f) => f.type.startsWith('image/'))
      if (file) void loadImage(file)
    },
    [loadImage],
  )

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (file) void loadImage(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadImage])

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        accept(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded border border-dashed px-4 py-6 text-center text-sm transition-colors ${
        dragging ? 'border-ink-400 bg-ink-800' : 'border-ink-700 hover:border-ink-600'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => accept(e.target.files)}
      />
      {source ? (
        <div className="space-y-1">
          <div className="truncate text-ink-300">{source.name}</div>
          <div className="text-xs text-ink-500">
            {source.width} × {source.height} px · 点击更换
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-ink-300">拖拽图片到此处</div>
          <div className="text-xs text-ink-500">或点击选择 · 支持 Ctrl/Cmd+V 粘贴</div>
          <div className="text-xs text-ink-600">PNG / JPG / GIF / WebP · 带透明背景的图会自动留空</div>
        </div>
      )}
    </div>
  )
}
