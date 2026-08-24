"use client"
import { useState } from "react"
import { createQuickProduct } from "@/app/actions/product"
import { Loader2, X } from "lucide-react"

export function ProductModal({
  forceOpen,
  onForceClose,
  onSuccess
}: {
  forceOpen: boolean
  onForceClose: () => void
  onSuccess?: (product: any) => void
}) {
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdDesc, setNewProdDesc] = useState("")
  const [newProdUnit, setNewProdUnit] = useState("NUM")
  const [newProdGst, setNewProdGst] = useState("18")
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)

  if (!forceOpen) return null

  const handleCreateProduct = async () => {
    if (!newProdDesc.trim()) return alert("Description is required")
    setIsCreatingProduct(true)
    try {
      const res = await createQuickProduct({
        materialCode: newProdCode,
        materialDescription: newProdDesc,
        unit: newProdUnit,
        gstRate: parseFloat(newProdGst) || 18
      })
      if (res.success && res.product) {
        setNewProdCode("")
        setNewProdDesc("")
        setNewProdUnit("NUM")
        setNewProdGst("18")
        if (onSuccess) onSuccess(res.product)
        onForceClose()
      } else {
        alert(res.error)
      }
    } catch (e) {
      alert("Failed to create product")
    } finally {
      setIsCreatingProduct(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0">
      <div className="glass-panel w-full max-w-md p-6 rounded-md border border-premium-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-white">New Product</h3>
          <button onClick={onForceClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Material Code (Optional)</label>
            <input 
              value={newProdCode} onChange={e => setNewProdCode(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              placeholder="Auto-generated if left blank"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Description *</label>
            <input 
              autoFocus value={newProdDesc} onChange={e => setNewProdDesc(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Unit</label>
              <input 
                value={newProdUnit} onChange={e => setNewProdUnit(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">GST %</label>
              <input 
                type="number" value={newProdGst} onChange={e => setNewProdGst(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              />
            </div>
          </div>
          <button 
            type="button"
            onClick={handleCreateProduct} disabled={isCreatingProduct || !newProdDesc.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-md transition-colors mt-4"
          >
            {isCreatingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create & Add Product"}
          </button>
        </div>
      </div>
    </div>
  )
}
