import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { RfqActions } from "@/components/RfqActions"
import { RfqStatusBadge } from "@/components/RfqStatusBadge"
import { Metadata } from "next"
import { formatRupee, numberToWordsRupees } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Rfq ${id}`
  }
}

export default async function RfqViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: { product: true }
      }
    }
  })

  if (!rfq) {
    redirect("/rfqs")
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  const isDraft = rfq.status === "DRAFT"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl py-4 -mx-8 px-8 border-b border-premium-border/50 mb-6 print:static print:bg-transparent print:border-none print:p-0 print:m-0 print:mb-6">
        <div className="print:hidden">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Rfq {rfq.id.slice(-6).toUpperCase()}</h1>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">Status:</span>
            <RfqStatusBadge id={rfq.id} currentStatus={rfq.status} />
          </div>
        </div>
        <RfqActions rfq={rfq} settings={settings} />
      </div>

      {/* Dashboard View Container */}
      <div className="glass-panel p-8 rounded-lg relative overflow-hidden print:hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header Section */}
        <div className="flex justify-between items-start mb-12 border-b border-premium-border pb-8 relative z-10">
          <div>
            <img src={settings?.logoUrl || "/logo-long.png"} alt="Logo" className="h-16 object-contain mb-4" />
            <div className="text-zinc-400 text-sm mt-4 space-y-1">
              <p><strong>To:</strong> {rfq.supplier.name}</p>
              
              
            </div>
          </div>
          <div className="text-right text-zinc-400 text-sm space-y-1">
            <p><strong>Date:</strong> {new Date(rfq.createdAt).toLocaleDateString()}</p>
            <p><strong>Quote No:</strong> {rfq.id}</p>
          </div>
        </div>

        {/* Message */}
        {settings?.quotationMessage && (
          <p 
            className="text-zinc-300 mb-8 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: settings.quotationMessage }}
          />
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
              {rfq.items.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 even:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-4 text-white font-mono text-xs">{item.product.materialCode}</td>
                  <td className="py-4 px-4">
                    <div className="text-zinc-300">{item.product.materialDescription}</div>
                    {item.product.specification && (
                      <div className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{item.product.specification}</div>
                    )}
                    {item.comment && (
                      <div className="text-xs text-brand-orange/80 mt-1 italic whitespace-pre-wrap break-words">{item.comment}</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center text-zinc-400 text-xs font-mono">{item.product.unit}</td>
                  <td className="py-4 px-4 text-center text-zinc-300">{item.quantity}</td>
                  
                  <td className="py-4 px-4 text-right text-zinc-300">{formatRupee(item.cpSnapshot)}</td>
                  <td className="py-4 px-4 text-right text-white font-medium">{formatRupee(Math.round(item.cpSnapshot * item.quantity))}</td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>



        <div className="hidden print:flex justify-end mb-12">
            <div className="w-72 space-y-3 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal (excl. GST)</span>
                <span>{formatRupee(rfq.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total GST</span>
                <span>{formatRupee(rfq.totalGst)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-brand-orange pt-3 border-t border-premium-border">
                <span>Grand Total</span>
                <span>{formatRupee(rfq.totalAmount + rfq.totalGst)}</span>
              </div>
              
            </div>
          </div>

        {/* Bottom Details */}
        {settings?.bottomDetails && (
          <div 
            className="pt-8 border-t border-premium-border text-sm text-zinc-500 whitespace-pre-wrap relative z-10"
            dangerouslySetInnerHTML={{ __html: settings.bottomDetails }}
          />
        )}
        
        <div className="pt-4 text-sm font-medium text-zinc-400">
          Amount in words: <span className="text-white">{numberToWordsRupees(rfq.totalAmount + rfq.totalGst)}</span>
        </div>

      </div>

      {/* Totals (Sticky Bottom Bar) */}
      
    </div>
  )
}
