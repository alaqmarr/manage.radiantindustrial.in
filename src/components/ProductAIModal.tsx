"use client"

import { useState } from "react"
import { Sparkles, X, Loader2 } from "lucide-react"
import { askGeminiProductDetails } from "@/app/actions/ai"
import ReactMarkdown from "react-markdown"

export function ProductAIModal({ product }: { 
  product: { description: string; make: string; model: string; specification: string } 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent clicking the row
    e.preventDefault()
    setIsOpen(true)
    
    if (!content && !isLoading) {
      setIsLoading(true)
      setError(null)
      try {
        const res = await askGeminiProductDetails(product)
        if (res.success && res.text) {
          setContent(res.text)
        } else {
          setError(res.error || "Failed to load AI data.")
        }
      } catch (err: any) {
        setError("An unexpected error occurred.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(false)
  }

  return (
    <>
      <button 
        onClick={handleOpen}
        className="p-1.5 text-brand-orange hover:bg-brand-orange/10 rounded-lg transition-colors group relative"
        title="Ask AI about this product"
      >
        <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={handleClose}>
          <div 
            className="glass-panel w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-premium-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-premium-border/50 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-brand-orange to-brand-orange-dark rounded-lg shadow-lg shadow-brand-orange/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white tracking-tight">AI Insights & Sourcing</h3>
                  <p className="text-sm text-zinc-400">{product.description}</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-transparent to-black/20">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-4 text-brand-orange">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm font-medium animate-pulse text-zinc-400">Analyzing product and local sourcing in Hyderabad...</p>
                </div>
              ) : error ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-sm">
                  {error}
                </div>
              ) : content ? (
                <div className="prose prose-invert prose-zinc max-w-none prose-headings:text-white prose-a:text-brand-orange prose-img:rounded-xl prose-img:shadow-lg prose-img:border prose-img:border-white/10">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
