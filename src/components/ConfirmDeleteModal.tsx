"use client"

import { useEffect } from "react"
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert } from "lucide-react"

export interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting?: boolean
  title: string
  description: string
  impactItems?: string[]
  confirmLabel?: string
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  title,
  description,
  impactItems = [],
  confirmLabel = "Delete Permanently",
}: ConfirmDeleteModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, isDeleting, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs print:hidden"
      onClick={() => {
        if (!isDeleting) onClose()
      }}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {title}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          {!isDeleting && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Impact Summary Box */}
        {impactItems.length > 0 && (
          <div className="px-6 pb-4">
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Deletion Impact</span>
              </div>
              <ul className="space-y-1.5">
                {impactItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-amber-950 font-medium"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-white" />
            )}
            <span className="text-white">
              {isDeleting ? "Deleting..." : confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
