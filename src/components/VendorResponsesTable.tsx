"use client"
import { useState } from "react"
import { formatRupee } from "@/lib/utils"
import { convertRfqResponseToPo } from "@/app/actions/rfq"
import { Loader2, Trophy, ExternalLink, Mail, Phone, Clock, FileText } from "lucide-react"

export function VendorResponsesTable({ rfq }: { rfq: any }) {
  const [awardingId, setAwardingId] = useState<string | null>(null)

  const handleAward = async (responseId: string) => {
    if (!confirm("Are you sure you want to award this RFQ to this vendor? This will create a DRAFT Purchase Order with their prices.")) return

    setAwardingId(responseId)
    const res = await convertRfqResponseToPo(responseId)
    if (res.error) {
      alert(res.error)
      setAwardingId(null)
    } else {
      alert("Successfully converted to PO!")
      window.location.href = `/purchase-orders/${res.id}`
    }
  }

  if (!rfq.isPublic) return null

  const responses = rfq.responses || []

  return (
    <div className="mt-12 pt-8 border-t border-premium-border print:hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-brand-orange" />
            Vendor Responses
          </h2>
          <p className="text-sm text-zinc-400 mt-1">Compare quotes submitted via the public vendor portal.</p>
        </div>
        <div className="bg-brand-slate/10 border border-brand-slate/20 rounded-md px-4 py-2">
          <p className="text-xs text-brand-slate mb-1">Public Share Link:</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-white bg-black/40 px-2 py-1 rounded select-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/vendor-quote/${rfq.publicToken}` : `.../vendor-quote/${rfq.publicToken}`}
            </code>
          </div>
        </div>
      </div>

      {responses.length === 0 ? (
        <div className="text-center p-8 bg-zinc-900/50 border border-zinc-800 rounded-md text-zinc-500">
          No vendors have submitted responses yet. Share the link above to invite quotes.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {responses.map((response: any) => {
            let totalQuote = 0
            response.items.forEach((ri: any) => {
              const baseQty = rfq.items.find((i: any) => i.id === ri.rfqItemId)?.quantity || 0
              totalQuote += ri.unitPrice * baseQty
            })

            return (
              <div key={response.id} className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 border-b border-zinc-800">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {response.vendorName}
                      {response.supplierId && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded tracking-wide uppercase">Verified Supplier</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-zinc-400">
                      {response.vendorEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {response.vendorEmail}</span>}
                      {response.vendorPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {response.vendorPhone}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> Submitted {new Date(response.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Total Quote</p>
                    <p className="text-xl font-bold text-emerald-400">{formatRupee(totalQuote)}</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-black/20 text-zinc-500">
                      <tr>
                        <th className="py-2 px-4">Item</th>
                        <th className="py-2 px-4 text-center">Qty</th>
                        <th className="py-2 px-4 text-right">Unit Price</th>
                        <th className="py-2 px-4 text-right">Total</th>
                        <th className="py-2 px-4">Lead Time / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {response.items.map((ri: any) => {
                        const baseItem = rfq.items.find((i: any) => i.id === ri.rfqItemId)
                        return (
                          <tr key={ri.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 text-zinc-300">
                              <div className="font-medium text-white">{baseItem?.product?.materialCode}</div>
                              <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{baseItem?.product?.materialDescription}</div>
                            </td>
                            <td className="py-3 px-4 text-center text-zinc-400">{baseItem?.quantity} {baseItem?.product?.unit}</td>
                            <td className="py-3 px-4 text-right font-medium text-white">{formatRupee(ri.unitPrice)}</td>
                            <td className="py-3 px-4 text-right text-emerald-400/80">{formatRupee(ri.unitPrice * (baseItem?.quantity || 0))}</td>
                            <td className="py-3 px-4">
                              {ri.leadTime && <div className="text-xs text-brand-orange">Lead: {ri.leadTime}</div>}
                              {ri.remarks && <div className="text-xs text-zinc-400 mt-1 flex items-start gap-1"><FileText className="w-3 h-3 shrink-0 mt-0.5"/> {ri.remarks}</div>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-black/20 border-t border-zinc-800 flex justify-end">
                  <button 
                    onClick={() => handleAward(response.id)}
                    disabled={awardingId === response.id || rfq.status === "COMPLETED"}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-md transition-colors disabled:opacity-50"
                  >
                    {awardingId === response.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trophy className="w-4 h-4"/>}
                    Award & Create PO
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
