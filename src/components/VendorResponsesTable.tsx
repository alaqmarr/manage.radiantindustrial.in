"use client"

import { useState, useMemo, useEffect } from "react"
import { formatRupee } from "@/lib/utils"
import { convertRfqResponseToPo } from "@/app/actions/rfq"
import {
  Loader2,
  Trophy,
  ExternalLink,
  Mail,
  Phone,
  Clock,
  FileText,
  Copy,
  Check,
  Globe,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react"
import { sileo } from "sileo"

export function VendorResponsesTable({ rfq }: { rfq: any }) {
  const [awardingId, setAwardingId] = useState<string | null>(null)
  const [confirmAwardResponse, setConfirmAwardResponse] = useState<any | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }
  }, [])

  if (!rfq.isPublic) return null

  const responses = rfq.responses || []
  const publicUrl = origin
    ? `${origin}/vendor-quote/${rfq.publicToken}`
    : `/vendor-quote/${rfq.publicToken}`

  // Compute lowest unit price (L1) per rfqItemId across all submitted responses
  const lowestPriceByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const resp of responses) {
      for (const ri of resp.items || []) {
        if (ri.unitPrice > 0) {
          const currentMin = map.get(ri.rfqItemId)
          if (currentMin === undefined || ri.unitPrice < currentMin) {
            map.set(ri.rfqItemId, ri.unitPrice)
          }
        }
      }
    }
    return map
  }, [responses])

  // Enrich responses with totals & quoted count
  const enrichedResponses = useMemo(() => {
    return responses
      .map((response: any) => {
        let subtotalPaise = 0
        let gstPaise = 0
        let quotedItemsCount = 0

        for (const ri of response.items || []) {
          if (ri.unitPrice > 0) {
            quotedItemsCount++
            const baseItem = rfq.items.find((i: any) => i.id === ri.rfqItemId)
            const qty = baseItem?.quantity || 0
            const gstRate = baseItem?.product?.gstRate ?? 18
            const lineAmt = ri.unitPrice * qty
            subtotalPaise += lineAmt
            gstPaise += Math.round(lineAmt * (gstRate / 100))
          }
        }

        return {
          ...response,
          quotedItemsCount,
          subtotalPaise,
          gstPaise,
          grandTotalPaise: subtotalPaise + gstPaise,
        }
      })
      .sort((a: any, b: any) => {
        // Sort full quotes first, then by lowest subtotal
        if (b.quotedItemsCount !== a.quotedItemsCount) {
          return b.quotedItemsCount - a.quotedItemsCount
        }
        return a.subtotalPaise - b.subtotalPaise
      })
  }, [responses, rfq.items])

  const handleCopyPublicLink = async () => {
    const fullUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/vendor-quote/${rfq.publicToken}`
        : publicUrl
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedLink(true)
      sileo.success({
        title: "Public RFQ Link Copied",
        description: "Share this link with vendors via Email or WhatsApp — no login required.",
      })
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      sileo.error({
        title: "Copy Failed",
        description: "Please select and copy the link manually.",
      })
    }
  }

  const executeAward = async () => {
    if (!confirmAwardResponse) return
    const responseId = confirmAwardResponse.id
    setAwardingId(responseId)
    try {
      const res = await convertRfqResponseToPo(responseId)
      if (res.error) {
        sileo.error({ title: "Award Failed", description: res.error })
        setAwardingId(null)
      } else {
        sileo.success({
          title: "RFQ Awarded & PO Created",
          description: `Draft Purchase Order created for ${confirmAwardResponse.vendorName}.`,
        })
        setConfirmAwardResponse(null)
        window.location.href = `/purchase-orders/${res.id}`
      }
    } catch {
      sileo.error({
        title: "Award Failed",
        description: "An unexpected error occurred while converting the bid.",
      })
      setAwardingId(null)
    }
  }

  return (
    <div className="space-y-6 print:hidden">
      {/* Public Portal Share Bar */}
      <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Public Vendor Bidding Portal Link
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              No Auth Required
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Send this link to any number of vendors. Their submitted rates and lead times appear below automatically.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-800 select-all truncate max-w-md">
            {publicUrl}
          </div>
          <button
            type="button"
            onClick={handleCopyPublicLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-white" />
            )}
            <span className="text-white">{copiedLink ? "Copied!" : "Copy Link"}</span>
          </button>
          <a
            href={`/vendor-quote/${rfq.publicToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-colors shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Preview Portal</span>
          </a>
        </div>
      </div>

      {/* Section Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-600" />
            Submitted Vendor Quotations ({enrichedResponses.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Lowest unit rates across bids are highlighted as <strong className="text-emerald-700">L1 Lowest</strong>. Awarding a bid automatically creates or links the Supplier and generates a Draft PO.
          </p>
        </div>
      </div>

      {enrichedResponses.length === 0 ? (
        <div className="text-center py-10 px-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
          <Globe className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            No vendor responses submitted yet
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Copy the Public Vendor Bidding Link above or use the <strong>Email RFQ</strong> button at the top of the page to invite suppliers to quote online.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {enrichedResponses.map((response: any, index: number) => {
            const isBestOverall =
              index === 0 &&
              enrichedResponses.length > 1 &&
              response.quotedItemsCount === rfq.items.length

            return (
              <div
                key={response.id}
                className={`bg-white border rounded-xl overflow-hidden shadow-2xs transition-all ${
                  isBestOverall ? "border-emerald-300 ring-1 ring-emerald-500/20" : "border-slate-200"
                }`}
              >
                {/* Vendor Bid Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {response.vendorName}
                      </h3>
                      {response.supplierId ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" /> Registered Supplier
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          New Vendor (Auto-Registers on Award)
                        </span>
                      )}
                      {isBestOverall && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-white" /> Lowest Full Bid
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-600">
                      {response.vendorEmail && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {response.vendorEmail}
                        </span>
                      )}
                      {response.vendorPhone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {response.vendorPhone}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Submitted{" "}
                        {new Date(response.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px] font-semibold text-slate-700">
                        Quoted {response.quotedItemsCount} / {rfq.items.length} items
                      </span>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Total Bid (Excl. GST: {formatRupee(response.subtotalPaise)})
                    </div>
                    <div className="text-xl font-black font-mono text-emerald-700">
                      {formatRupee(response.grandTotalPaise)}
                    </div>
                    <div className="text-[10px] text-slate-500">Incl. Estimated GST</div>
                  </div>
                </div>

                {/* Bid Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Item</th>
                        <th className="py-2.5 px-4 text-center">Req Qty</th>
                        <th className="py-2.5 px-4 text-right">Quoted Unit Rate (Excl. GST)</th>
                        <th className="py-2.5 px-4 text-right">Line Subtotal</th>
                        <th className="py-2.5 px-4">Lead Time & Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rfq.items.map((baseItem: any) => {
                        const ri = (response.items || []).find(
                          (x: any) => x.rfqItemId === baseItem.id
                        )
                        const unitPrice = ri?.unitPrice || 0
                        const isQuoted = unitPrice > 0
                        const isL1 =
                          isQuoted && lowestPriceByItem.get(baseItem.id) === unitPrice

                        return (
                          <tr key={baseItem.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-mono text-xs font-bold text-slate-900">
                                {baseItem.product?.materialCode}
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                {baseItem.itemDescription ||
                                  baseItem.product?.materialDescription}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-slate-700">
                              {baseItem.quantity} {baseItem.product?.unit}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isQuoted ? (
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {isL1 && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase">
                                      L1 Lowest
                                    </span>
                                  )}
                                  <span className="font-mono font-bold text-slate-900">
                                    {formatRupee(unitPrice)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Not Quoted</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-800">
                              {isQuoted ? formatRupee(unitPrice * baseItem.quantity) : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                {ri?.leadTime && (
                                  <div className="text-xs font-semibold text-orange-700">
                                    Lead Time: {ri.leadTime}
                                  </div>
                                )}
                                {ri?.remarks && (
                                  <div className="text-xs text-slate-600 flex items-start gap-1">
                                    <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                    <span>{ri.remarks}</span>
                                  </div>
                                )}
                                {!ri?.leadTime && !ri?.remarks && (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Action Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-500">
                    {rfq.status === "COMPLETED"
                      ? "This RFQ has already been marked as Completed."
                      : "Awarding creates a Draft Purchase Order pre-filled with this vendor's rates."}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmAwardResponse(response)}
                    disabled={awardingId === response.id || rfq.status === "COMPLETED"}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {awardingId === response.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Trophy className="w-4 h-4 text-white" />
                    )}
                    <span className="text-white">Award & Create Draft PO</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Award Confirmation Modal */}
      {confirmAwardResponse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-600" />
                Award RFQ to {confirmAwardResponse.vendorName}?
              </h3>
              <button
                type="button"
                onClick={() => setConfirmAwardResponse(null)}
                disabled={!!awardingId}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                This will create a <strong>Draft Purchase Order</strong> for{" "}
                <strong className="text-slate-900">{confirmAwardResponse.vendorName}</strong> with{" "}
                <strong>{confirmAwardResponse.quotedItemsCount}</strong> priced item(s) totaling{" "}
                <strong className="font-mono text-emerald-700">
                  {formatRupee(confirmAwardResponse.grandTotalPaise)}
                </strong>{" "}
                (Incl. GST).
              </p>
              {!confirmAwardResponse.supplierId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
                  <strong>Note:</strong> {confirmAwardResponse.vendorName} is not yet in your Supplier Directory — they will be automatically registered and linked for you.
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmAwardResponse(null)}
                disabled={!!awardingId}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeAward}
                disabled={!!awardingId}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {awardingId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Trophy className="w-3.5 h-3.5 text-white" />
                )}
                <span className="text-white">
                  {awardingId ? "Creating PO..." : "Confirm & Create PO"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
