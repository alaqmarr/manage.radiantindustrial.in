import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { VendorQuoteForm } from "@/components/VendorQuoteForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: 'Request for Quotation | Radiant Industrial',
  description: 'Submit your quotation for Radiant Industrial'
}

export default async function VendorQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const rfq = await prisma.rfq.findUnique({
    where: { publicToken: token },
    include: {
      items: {
        include: { product: true }
      }
    }
  })

  if (!rfq || !rfq.isPublic) {
    notFound()
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-800 pb-8">
          <div>
            <img src={settings?.logoUrl || "/logo-long.png"} alt="Logo" className="h-12 md:h-16 object-contain mb-4" />
            <h1 className="text-2xl font-bold tracking-tight">Request for Quotation</h1>
            <p className="text-zinc-400 mt-1">Please provide your best prices and lead times for the following items.</p>
          </div>
          <div className="text-left md:text-right text-sm text-zinc-500">
            <p><strong>Ref:</strong> {rfq.id}</p>
            <p><strong>Date:</strong> {new Date(rfq.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Status Check */}
        {rfq.status === "COMPLETED" ? (
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-lg text-center">
            <h2 className="text-xl font-bold text-white mb-2">RFQ Closed</h2>
            <p className="text-zinc-400">This request for quotation has already been closed or awarded. Thank you for your interest.</p>
          </div>
        ) : (
          <VendorQuoteForm rfq={rfq} token={token} />
        )}
      </div>
    </div>
  )
}
