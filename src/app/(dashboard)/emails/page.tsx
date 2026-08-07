import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import { EmailTemplateBuilder } from "@/components/EmailTemplateBuilder"

export const metadata: Metadata = {
  title: "Email Templates"
}

export default async function EmailsPage() {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2 font-heading">Email Templates</h1>
        <p className="text-zinc-400">Generate professional, branded emails to send to your clients.</p>
      </div>

      <EmailTemplateBuilder settings={settings} />
    </div>
  )
}
