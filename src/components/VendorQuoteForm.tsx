"use client"

import { useState, useMemo } from "react"
import { submitRfqResponse } from "@/app/actions/rfq"
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Send,
  Printer,
  Clock,
  IndianRupee,
  RotateCcw,
} from "lucide-react"
import { formatRupee, formatShortId } from "@/lib/utils"
import { SmartNumberInput } from "./ui/SmartNumberInput"

const LEAD_TIME_PRESETS = ["Ready Stock", "2-3 Days", "1 Week", "2 Weeks"]

export function VendorQuoteForm({
  rfq,
  token,
  companyName = "Radiant Industrial Company",
}: {
  rfq: any
  token: string
  companyName?: string
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  const [vendorName, setVendorName] = useState("")
  const [vendorEmail, setVendorEmail] = useState("")
  const [vendorPhone, setVendorPhone] = useState("")

  const [prices, setPrices] = useState<
    Record<string, { price: string; leadTime: string; remarks: string }>
  >({})

  const shortRef = formatShortId(rfq.id)

  const updateItemField = (
    itemId: string,
    field: "price" | "leadTime" | "remarks",
    value: string
  ) => {
    setPrices((prev) => ({
      ...prev,
      [itemId]: {
        price: prev[itemId]?.price || "",
        leadTime: prev[itemId]?.leadTime || "",
        remarks: prev[itemId]?.remarks || "",
        [field]: value,
      },
    }))
  }

  const summary = useMemo(() => {
    let quotedCount = 0
    let subtotalPaise = 0
    let gstPaise = 0

    for (const item of rfq.items || []) {
      const rateNum = parseFloat(prices[item.id]?.price || "0")
      if (!isNaN(rateNum) && rateNum > 0) {
        quotedCount++
        const unitPaise = Math.round(rateNum * 100)
        const lineSub = unitPaise * (item.quantity || 0)
        const gstRate = item.product?.gstRate ?? 18
        subtotalPaise += lineSub
        gstPaise += Math.round(lineSub * (gstRate / 100))
      }
    }

    return {
      quotedCount,
      totalItems: (rfq.items || []).length,
      subtotalPaise,
      gstPaise,
      grandTotalPaise: subtotalPaise + gstPaise,
    }
  }, [rfq.items, prices])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!vendorName.trim()) {
      setError("Please enter your Company / Firm Name.")
      return
    }

    const items = rfq.items.map((item: any) => {
      const p = prices[item.id]
      const parsed = p?.price ? parseFloat(p.price) : 0
      return {
        rfqItemId: item.id,
        unitPrice: !isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0,
        leadTime: p?.leadTime?.trim() || undefined,
        remarks: p?.remarks?.trim() || undefined,
      }
    })

    if (!items.some((i: any) => i.unitPrice > 0)) {
      setError("Please enter a Unit Rate greater than ₹0 for at least one item.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await submitRfqResponse(token, {
        vendorName: vendorName.trim(),
        vendorEmail: vendorEmail.trim(),
        vendorPhone: vendorPhone.trim(),
        items,
      })

      if (res.error) {
        setError(res.error)
        setIsSubmitting(false)
      } else {
        setIsSuccess(true)
        setIsSubmitting(false)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    } catch (err) {
      setError("Network error while submitting your quote. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden animate-in fade-in duration-200">
        <div className="bg-emerald-50/80 border-b border-emerald-200 p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            Quotation Submitted Successfully!
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 max-w-xl mx-auto">
            Thank you, <strong className="text-slate-900">{vendorName}</strong>. Your rates for RFQ{" "}
            <span className="font-mono font-bold text-slate-900">#{shortRef}</span> have been
            securely recorded for {companyName}.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-5 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Print / Save Submission Copy
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false)
                setPrices({})
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-white" />
              <span className="text-white">Submit Revised / Another Quote</span>
            </button>
          </div>
        </div>

        {/* Submitted Summary Receipt */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
            <div>
              <span className="text-slate-400 uppercase font-bold block text-[10px]">
                Submitted By
              </span>
              <span className="font-bold text-slate-900 text-sm">{vendorName}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-bold block text-[10px]">
                Contact Info
              </span>
              <span className="font-medium text-slate-700">
                {[vendorEmail, vendorPhone].filter(Boolean).join(" · ") || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-bold block text-[10px]">
                Total Quoted (Incl. GST)
              </span>
              <span className="font-mono font-bold text-emerald-700 text-base">
                {formatRupee(summary.grandTotalPaise)}
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Rate (Excl. GST)</th>
                  <th className="py-3 px-4 text-right">Line Subtotal</th>
                  <th className="py-3 px-4">Lead Time & Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rfq.items.map((item: any) => {
                  const p = prices[item.id]
                  const rateNum = parseFloat(p?.price || "0")
                  const isQuoted = !isNaN(rateNum) && rateNum > 0
                  const unitPaise = isQuoted ? Math.round(rateNum * 100) : 0
                  return (
                    <tr key={item.id}>
                      <td className="py-3 px-4">
                        <div className="font-mono text-xs font-bold text-slate-800">
                          {item.product.materialCode}
                        </div>
                        <div className="text-xs text-slate-600">
                          {item.effectiveDescription ||
                            item.itemDescription ||
                            item.product.materialDescription}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-slate-700">
                        {item.quantity} {item.product.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-bold text-slate-900">
                        {isQuoted ? (
                          formatRupee(unitPaise)
                        ) : (
                          <span className="text-slate-400 italic font-sans font-normal">
                            Not Quoted
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-emerald-700">
                        {isQuoted ? formatRupee(unitPaise * item.quantity) : "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {[p?.leadTime, p?.remarks].filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-800 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
              Please Check Your Submission
            </h4>
            <p className="text-sm font-medium mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1: Vendor Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-600 text-white text-xs font-black inline-flex items-center justify-center">
                1
              </span>
              Your Company & Contact Details
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Provide your organization details so our procurement team can reach out or issue a Purchase Order.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Company / Firm Name <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                required
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className={`${inputClass} pl-10 font-medium`}
                placeholder="e.g. Apex Industrial Supplies"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Phone / WhatsApp Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                className={`${inputClass} pl-10`}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Business Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                className={`${inputClass} pl-10`}
                placeholder="sales@company.com"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Items & Pricing Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-600 text-white text-xs font-black inline-flex items-center justify-center">
                2
              </span>
              Requested Items & Commercial Rates
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your net Unit Price (Excl. GST). Leave an item blank if you do not wish to quote for it.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 self-start sm:self-auto">
            <span>Items Priced:</span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono font-bold ${
                summary.quotedCount > 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {summary.quotedCount} / {summary.totalItems}
            </span>
          </div>
        </div>

        {/* Desktop & Tablet Responsive Table / Mobile Cards */}
        <div className="divide-y divide-slate-200">
          {rfq.items.map((item: any, idx: number) => {
            const entry = prices[item.id] || { price: "", leadTime: "", remarks: "" }
            const rateNum = parseFloat(entry.price || "0")
            const hasValidRate = !isNaN(rateNum) && rateNum > 0
            const lineSubtotalPaise = hasValidRate
              ? Math.round(rateNum * 100) * (item.quantity || 0)
              : 0
            const gstRate = item.product?.gstRate ?? 18

            return (
              <div
                key={item.id}
                className={`p-5 sm:p-6 transition-colors ${
                  hasValidRate ? "bg-emerald-50/20" : "hover:bg-slate-50/60"
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left: Item Specification & Required Qty */}
                  <div className="lg:col-span-5 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        #{idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-800">
                        {item.product.materialCode}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 font-mono text-xs font-bold text-orange-800">
                        Req Qty: {item.quantity} {item.product.unit}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        GST: {gstRate}%
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900 leading-snug pt-0.5">
                      {item.effectiveDescription ||
                        item.itemDescription ||
                        item.product.materialDescription}
                    </div>

                    {item.product.specification && (
                      <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 mt-1">
                        {item.product.specification}
                      </div>
                    )}

                    {item.comment && (
                      <div className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-1">
                        Buyer Note: {item.comment}
                      </div>
                    )}
                  </div>

                  {/* Right: Vendor Rate, Lead Time & Remarks Inputs */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                    {/* Unit Price */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Unit Rate ₹ (Excl. GST)
                      </label>
                      <div className="relative">
                        <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <SmartNumberInput
                          value={entry.price}
                          onValueChange={(_, str) => updateItemField(item.id, "price", str)}
                          placeholder="0.00"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                      </div>
                      <div className="mt-1 text-[11px] font-mono">
                        {hasValidRate ? (
                          <span className="text-emerald-700 font-semibold">
                            Line Total: {formatRupee(lineSubtotalPaise)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Per {item.product.unit}</span>
                        )}
                      </div>
                    </div>

                    {/* Lead Time */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Delivery / Lead Time
                      </label>
                      <div className="relative">
                        <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="e.g. Ready Stock"
                          value={entry.leadTime}
                          onChange={(e) => updateItemField(item.id, "leadTime", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {LEAD_TIME_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateItemField(item.id, "leadTime", preset)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              entry.leadTime === preset
                                ? "bg-orange-100 border-orange-300 text-orange-800 font-bold"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Brand / Make / Remarks */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Make / Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Make, MOQ, warranty..."
                        value={entry.remarks}
                        onChange={(e) => updateItemField(item.id, "remarks", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 3: Live Totals & Submit Bar */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Subtotal (Excl. GST)
            </div>
            <div className="text-base font-bold font-mono text-slate-900">
              {formatRupee(summary.subtotalPaise)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Estimated GST
            </div>
            <div className="text-base font-semibold font-mono text-slate-600">
              {formatRupee(summary.gstPaise)}
            </div>
          </div>
          <div className="pl-4 border-l border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              Total Quote Value (Incl. GST)
            </div>
            <div className="text-xl font-black font-mono text-orange-600">
              {formatRupee(summary.grandTotalPaise)}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span className="text-white">Submitting Quotation...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4 text-white" />
              <span className="text-white">Submit Quotation ({summary.quotedCount} Items)</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
