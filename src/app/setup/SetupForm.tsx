"use client"
import { useState } from "react"
import { setupAction } from "@/app/actions/setup"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"

export function SetupForm() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError("")
    
    const res = await setupAction(formData)
    
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      router.push("/login")
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-md mb-6">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Name</label>
          <input 
            name="name" 
            type="text" 
            required
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-md px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all"
            placeholder="Admin Name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
          <input 
            name="email" 
            type="email" 
            required
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-md px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all"
            placeholder="admin@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
          <input 
            name="password" 
            type="password" 
            required
            minLength={6}
            className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-md px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all"
            placeholder="••••••••"
          />
        </div>
        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-brand-orange hover:bg-[#d87625] text-white font-medium py-2.5 rounded-md transition-colors mt-2 shadow-[0_0_15px_rgba(244,140,54,0.2)] disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Admin Account"}
        </button>
      </form>
    </motion.div>
  )
}

