import { prisma } from "@/lib/prisma"
import { SettingsForm } from "@/components/SettingsForm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Company Settings</h1>
        <p className="text-zinc-400 mt-2">Manage your company details for quotations and prints.</p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  )
}
