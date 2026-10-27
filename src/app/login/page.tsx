"use client"
import { useState } from "react"
import { loginAction } from "@/app/actions/auth"
import { sileo } from "sileo"
import { Lock, Mail, ArrowRight } from "lucide-react"

export default function LoginPage() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError("")
    setLoading(true)
    try {
      const res = await loginAction(formData)
      if (res?.error) {
        setError(res.error)
        sileo.error({
          title: "Authentication Failed",
          description: res.error,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-lg space-y-7">
        <div className="text-center">
          <img
            src="/logo-full.png"
            alt="Radiant Industrial Co."
            className="h-16 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Radiant Industrial Portal
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in with your authorized workspace credentials
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-lg font-medium">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                name="email"
                type="email"
                required
                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 transition-all"
                placeholder="name@radiantindustrial.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                name="password"
                type="password"
                required
                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all mt-2 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="text-white">{loading ? "Signing In..." : "Sign In to Workspace"}</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>
    </div>
  )
}
