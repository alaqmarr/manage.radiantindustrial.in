import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import { EmailTemplateBuilder } from "@/components/EmailTemplateBuilder"
import { Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Email Templates",
}

export default async function EmailsPage() {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  })

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
          <Mail className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email Templates</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Generate professional, branded emails to send to your clients and suppliers.
          </p>
        </div>
      </div>

      <EmailTemplateBuilder settings={settings} />
    </div>
  )
}
