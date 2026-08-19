import { useEffect, useRef, useState } from 'react'

export function HelpTip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="说明"
        className={`grid size-4 place-items-center rounded-full border text-[10px] leading-none transition-colors ${
          open ? 'border-ink-400 text-ink-200' : 'border-ink-600 text-ink-500 hover:border-ink-400 hover:text-ink-300'
        }`}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute top-5 -left-1 z-20 w-[min(15rem,calc(100vw-3rem))] rounded border border-ink-600 bg-ink-850 p-2.5 text-xs leading-relaxed font-normal text-ink-300 normal-case shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  )
}
