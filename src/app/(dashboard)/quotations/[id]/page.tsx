import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { QuotationActions } from "@/components/QuotationActions"

function formatRupee(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(paise / 100)
}

export default async function QuotationViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      client: true,
      items: {
        include: { product: true }
      }
    }
  })

  if (!quotation) {
    redirect("/quotations")
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  const isDraft = quotation.status === "DRAFT"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="print:hidden">
          <h1 className="text-3xl font-bold tracking-tight text-white">Quotation {quotation.id.slice(-6).toUpperCase()}</h1>
          <p className="text-zinc-400 mt-2">Status: <span className="text-white font-medium">{quotation.status}</span></p>
        </div>
        <QuotationActions quotation={quotation} settings={settings} />
      </div>

      {/* Dashboard View Container */}
      <div className="glass-panel p-8 rounded-2xl relative overflow-hidden print:hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header Section */}
        <div className="flex justify-between items-start mb-12 border-b border-premium-border pb-8 relative z-10">
          <div>
            <img src={settings?.logoUrl || "/logo-long.png"} alt="Logo" className="h-16 object-contain mb-4" />
            <div className="text-zinc-400 text-sm mt-4 space-y-1">
              <p><strong>To:</strong> {quotation.client.name}</p>
              {quotation.prNo && <p><strong>PR No:</strong> {quotation.prNo}</p>}
              {quotation.rfqNo && <p><strong>RFQ No:</strong> {quotation.rfqNo}</p>}
            </div>
          </div>
          <div className="text-right text-zinc-400 text-sm space-y-1">
            <p><strong>Date:</strong> {new Date(quotation.createdAt).toLocaleDateString()}</p>
            <p><strong>Quote No:</strong> {quotation.id}</p>
          </div>
        </div>

        {/* Message */}
        {settings?.quotationMessage && (
          <p className="text-zinc-300 mb-8 whitespace-pre-wrap">
            {settings.quotationMessage}
          </p>
        )}

        {/* Items Table */}
        <div className="mb-12 relative z-10">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-white/5 text-zinc-400 border-y border-premium-border">
              <tr>
                <th className="py-3 px-4 font-medium w-32">Code</th>
                <th className="py-3 px-4 font-medium min-w-[300px] w-auto">Description</th>
                <th className="py-3 px-4 font-medium text-center w-20">UOM</th>
                <th className="py-3 px-4 font-medium text-center w-24">Qty</th>
                <th className="py-3 px-4 font-medium text-right w-32">Rate</th>
                <th className="py-3 px-4 font-medium text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {quotation.items.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 even:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-4 text-white font-mono text-xs">{item.product.materialCode}</td>
                  <td className="py-4 px-4">
                    <div className="text-zinc-300">{item.product.materialDescription}</div>
                    {item.product.specification && (
                      <div className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{item.product.specification}</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center text-zinc-400 text-xs font-mono">{item.product.unit}</td>
                  <td className="py-4 px-4 text-center text-zinc-300">{item.quantity}</td>
                  
                  <td className="py-4 px-4 text-right text-zinc-300">{formatRupee(item.spSnapshot)}</td>
                  <td className="py-4 px-4 text-right text-white font-medium">{formatRupee(item.spSnapshot * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-12">
            <div className="w-72 space-y-3 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal (excl. GST)</span>
                <span>{formatRupee(quotation.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total GST</span>
                <span>{formatRupee(quotation.totalGst)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-brand-orange pt-3 border-t border-premium-border">
                <span>Grand Total</span>
                <span>{formatRupee(quotation.totalAmount + quotation.totalGst)}</span>
              </div>
            </div>
          </div>

        {/* Bottom Details */}
        {settings?.bottomDetails && (
          <div className="pt-8 border-t border-premium-border text-sm text-zinc-500 whitespace-pre-wrap relative z-10">
            {settings.bottomDetails}
          </div>
        )}

      </div>
    </div>
  )
}
