"use client"

import { Search, X } from "lucide-react"
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
    }, 250)

    return () => clearTimeout(handler)
  }, [term, router, searchParams])

  return (
    <div className="relative w-64 sm:w-72">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-slate-400" />
      </div>
      <input
        type="text"
        className="block w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg leading-5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm shadow-2xs transition-all"
        placeholder={placeholder}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      {term && (
        <button
          type="button"
          onClick={() => setTerm("")}
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700"
          title="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
