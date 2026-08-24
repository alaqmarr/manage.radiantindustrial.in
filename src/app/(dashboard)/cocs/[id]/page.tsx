import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { CocActions } from "@/components/CocActions"
import { Metadata } from "next"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Certificate ${id}`
  }
}

export default async function CocViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const coc = await prisma.certificateOfConformance.findUnique({
    where: { id },
    include: {
      client: true,
      items: {
        include: { product: true }
      }
    }
  })

  if (!coc) {
    redirect("/cocs")
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl py-4 -mx-8 px-8 border-b border-premium-border/50 mb-6 print:static print:bg-transparent print:border-none print:p-0 print:m-0 print:mb-6">
        <div className="print:hidden">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Certificate {coc.cocNumber || coc.id.slice(0, 8)}</h1>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">Status:</span>
            <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
              coc.status === 'ISSUED' ? 'bg-emerald-500/10 text-emerald-500' :
              coc.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-500' :
              'bg-zinc-500/10 text-zinc-400'
            }`}>
              {coc.status}
            </span>
          </div>
        </div>
        <CocActions id={coc.id} currentStatus={coc.status} coc={coc} settings={settings} />
      </div>

      {/* Dashboard View Container */}
      <div className="glass-panel p-8 rounded-lg relative overflow-hidden print:hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header Section */}
        <div className="flex justify-between items-start mb-12 border-b border-premium-border pb-8 relative z-10">
          <div>
            <h2 className="text-xl font-bold text-emerald-500 mb-4">Certificate of Conformance</h2>
            <div className="text-zinc-400 text-sm space-y-1">
              <p><strong>Issued To:</strong> {coc.client.name}</p>
              {coc.client.address && <p>{coc.client.address}</p>}
            </div>
          </div>
          <div className="text-right text-zinc-400 text-sm space-y-1">
            <p><strong>COC No:</strong> {coc.cocNumber || coc.id.slice(0, 8)}</p>
            <p><strong>Date:</strong> {new Date(coc.date).toLocaleDateString()}</p>
            {coc.clientPoRef && <p><strong>Client PO Ref:</strong> {coc.clientPoRef}</p>}
          </div>
        </div>

        {/* Message */}
        <div className="text-zinc-300 mb-8 whitespace-pre-wrap relative z-10 text-lg">
          {coc.standardText || settings?.cocMessage || "We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources."}
        </div>

        {/* Items Table */}
        <div className="mb-12 relative z-10">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-white/5 text-zinc-400 border-y border-premium-border">
              <tr>
                <th className="py-3 px-4 font-medium w-16">#</th>
                <th className="py-3 px-4 font-medium min-w-[200px]">Product Details</th>
                <th className="py-3 px-4 font-medium text-center w-24">Qty</th>
                <th className="py-3 px-4 font-medium text-center w-48">Batch/Lot No</th>
                <th className="py-3 px-4 font-medium w-48">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {coc.items.map((item, index) => (
                <tr key={item.id} className="hover:bg-white/5 even:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-4 text-zinc-500 font-mono text-xs">{index + 1}</td>
                  <td className="py-4 px-4">
                    <div className="text-white font-medium">{item.product.materialDescription}</div>
                    <div className="text-brand-slate font-mono text-xs mt-1">{item.product.materialCode}</div>
                    {item.product.specification && (
                      <div className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{item.product.specification}</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-zinc-300">{item.quantity}</span>
                    <span className="text-zinc-500 text-xs ml-1">{item.product.unit}</span>
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-emerald-400 font-medium">
                    {item.batchNo || '-'}
                  </td>
                  <td className="py-4 px-4 text-zinc-400">
                    {item.remarks || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Remarks */}
        {coc.remarks && (
          <div className="pt-8 border-t border-premium-border text-sm text-zinc-400 whitespace-pre-wrap relative z-10">
            <h3 className="font-bold text-white mb-2 uppercase text-xs tracking-wider">Additional Remarks</h3>
            {coc.remarks}
          </div>
        )}
        
      </div>
    </div>
  )
}
