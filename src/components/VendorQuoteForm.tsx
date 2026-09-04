"use client"
import { useState } from "react"
import { submitRfqResponse } from "@/app/actions/rfq"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

export function VendorQuoteForm({ rfq, token }: { rfq: any, token: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  const [vendorName, setVendorName] = useState("")
  const [vendorEmail, setVendorEmail] = useState("")
  const [vendorPhone, setVendorPhone] = useState("")

  const [prices, setPrices] = useState<Record<string, { price: string, leadTime: string, remarks: string }>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!vendorName.trim()) {
      setError("Company Name is required.")
      return
    }

    // Build items array
    const items = rfq.items.map((item: any) => {
      const p = prices[item.id]
      return {
        rfqItemId: item.id,
        unitPrice: p?.price ? Math.round(parseFloat(p.price) * 100) : 0,
        leadTime: p?.leadTime || undefined,
        remarks: p?.remarks || undefined
      }
    })

    // Validate that at least one item has a price > 0
    if (!items.some((i: any) => i.unitPrice > 0)) {
      setError("Please provide a price for at least one item.")
      return
    }

    setIsSubmitting(true)
    const res = await submitRfqResponse(token, {
      vendorName,
      vendorEmail,
      vendorPhone,
      items
    })

    if (res.error) {
      setError(res.error)
      setIsSubmitting(false)
    } else {
      setIsSuccess(true)
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-lg text-center animate-in fade-in zoom-in-95">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Quote Submitted Successfully</h2>
        <p className="text-zinc-400">Thank you for your response. We will review your prices and get back to you shortly.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-md flex items-center gap-3 text-rose-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Vendor Details */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-white mb-4">Your Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Company Name *</label>
            <input 
              required
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange" 
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
            <input 
              type="email"
              value={vendorEmail}
              onChange={e => setVendorEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange" 
              placeholder="sales@acme.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
            <input 
              type="tel"
              value={vendorPhone}
              onChange={e => setVendorPhone(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange" 
              placeholder="+91 9876543210"
            />
          </div>
        </div>
      </div>

      {/* Items to Quote */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="text-lg font-medium text-white">Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-black/40 text-zinc-500">
              <tr>
                <th className="py-3 px-4 font-medium w-1/3">Item Description</th>
                <th className="py-3 px-4 font-medium text-center w-24">Qty</th>
                <th className="py-3 px-4 font-medium w-32">Unit Price (₹)</th>
                <th className="py-3 px-4 font-medium w-48">Lead Time</th>
                <th className="py-3 px-4 font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rfq.items.map((item: any) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-mono text-xs text-zinc-500 mb-1">{item.product.materialCode}</div>
                    <div className="font-medium text-white">{item.product.materialDescription}</div>
                    {item.comment && (
                      <div className="text-xs text-brand-orange mt-1">Note: {item.comment}</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="font-bold text-white">{item.quantity}</span>
                    <span className="text-zinc-500 ml-1">{item.product.unit}</span>
                  </td>
                  <td className="py-4 px-4">
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={prices[item.id]?.price || ""}
                      onChange={(e) => setPrices(prev => ({...prev, [item.id]: { ...prev[item.id], price: e.target.value }}))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    />
                  </td>
                  <td className="py-4 px-4">
                    <input 
                      type="text"
                      placeholder="e.g. 2 Days"
                      value={prices[item.id]?.leadTime || ""}
                      onChange={(e) => setPrices(prev => ({...prev, [item.id]: { ...prev[item.id], leadTime: e.target.value }}))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    />
                  </td>
                  <td className="py-4 px-4">
                    <input 
                      type="text"
                      placeholder="Optional remarks"
                      value={prices[item.id]?.remarks || ""}
                      onChange={(e) => setPrices(prev => ({...prev, [item.id]: { ...prev[item.id], remarks: e.target.value }}))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-3 bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-md transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Quotation"}
        </button>
      </div>
    </form>
  )
}
