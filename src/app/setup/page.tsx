import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SetupForm } from "./SetupForm"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  const adminCount = await prisma.user.count({
    where: { role: "ADMIN" }
  })

  if (adminCount > 0) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md space-y-8 bg-zinc-900 p-10 rounded-2xl border border-zinc-800 shadow-2xl">
        <div className="text-center">
          <img src="/logo-full-white.png" alt="Radiant Industrial Co." className="h-16 mx-auto mb-4 object-contain" />
          <h2 className="text-2xl font-bold tracking-tight text-white">
            System Setup
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Create the initial administrator account.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  )
}
