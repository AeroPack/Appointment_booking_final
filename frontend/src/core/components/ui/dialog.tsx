import { useEffect, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
}

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, close])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={close}
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-[480px] max-h-[90vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 fade-in duration-200">
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e3e5] shrink-0">
            <h2 className="text-[18px] font-bold text-[#191c1e]">{title}</h2>
            <button
              onClick={close}
              className="p-2 -mr-2 rounded-lg hover:bg-[#f2f4f6] text-[#6e7977] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
