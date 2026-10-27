import { prisma } from "@/lib/prisma"
import { SettingsForm } from "@/components/SettingsForm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Settings } from "lucide-react"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  })

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Company Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage your corporate identity, logo, digital signatory stamp, default PDF messages, and banking details.
          </p>
        </div>
      </div>

      <SettingsForm settings={settings} />
    </div>
  )
}
