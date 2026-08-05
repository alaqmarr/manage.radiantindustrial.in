"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader2, ArrowLeft } from "lucide-react"
import { askGeminiProductDetails } from "@/app/actions/ai"
import ReactMarkdown from "react-markdown"
import Link from "next/link"

export function ProductInsightsClient({ product }: { 
  product: { id: string; description: string; make: string; model: string; specification: string } 
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchInsights() {
      try {
        const res = await askGeminiProductDetails(product)
        if (!isMounted) return
        
        if (res.success && res.text) {
          setContent(res.text)
        } else {
          setError(res.error || "Failed to load AI data.")
        }
      } catch (err: any) {
        if (isMounted) setError("An unexpected error occurred.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchInsights()

    return () => { isMounted = false }
  }, [product])

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/products" 
          className="p-2 bg-premium-surface/50 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl border border-premium-border transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-3 bg-gradient-to-br from-brand-orange to-brand-orange-dark rounded-xl shadow-lg shadow-brand-orange/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">AI Sourcing Insights</h1>
          <p className="text-zinc-400 mt-1 flex items-center gap-2">
            Analysis for <strong className="text-brand-orange font-medium max-w-md truncate">{product.description}</strong>
          </p>
        </div>
      </div>

      {/* Content Area */}
      <div className="glass-panel p-8 rounded-2xl border border-premium-border min-h-[500px] relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-brand-orange">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm font-medium animate-pulse text-zinc-400">Scouring the live internet for suppliers in Hyderabad...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500">
            <h3 className="font-semibold text-lg mb-2">Error Generating Insights</h3>
            <p className="text-sm">{error}</p>
          </div>
        ) : content ? (
          <div className="prose prose-invert prose-zinc max-w-none prose-headings:text-white prose-a:text-brand-orange hover:prose-a:text-brand-orange-dark prose-img:rounded-xl prose-img:shadow-lg prose-img:border prose-img:border-white/10 prose-img:w-full prose-img:max-w-2xl prose-img:mx-auto">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : null}
      </div>
    </div>
  )
}
