"use client"

import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

export function SearchBar({ placeholder = "Search..." }: { placeholder?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [term, setTerm] = useState(searchParams.get("search") || "")

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (term) {
        params.set("search", term)
      } else {
        params.delete("search")
      }
      router.push(`?${params.toString()}`)
    }, 300)

    return () => clearTimeout(handler)
  }, [term, router, searchParams])

  return (
    <div className="relative w-64">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-zinc-500" />
      </div>
      <input
        type="text"
        className="block w-full pl-10 pr-3 py-2 border border-premium-border rounded-md leading-5 bg-premium-surface/50 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange sm:text-sm transition-all"
        placeholder={placeholder}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
    </div>
  )
}

