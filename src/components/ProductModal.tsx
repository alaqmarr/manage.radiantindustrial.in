"use client"
import { useState } from "react"
import { createQuickProduct } from "@/app/actions/product"
import { Loader2, X, PackagePlus } from "lucide-react"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { sileo } from "sileo"

export function ProductModal({
  forceOpen,
  onForceClose,
  onSuccess,
}: {
  forceOpen: boolean
  onForceClose: () => void
  onSuccess?: (product: any) => void
}) {
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdDesc, setNewProdDesc] = useState("")
  const [newProdUnit, setNewProdUnit] = useState("NUM")
  const [newProdGst, setNewProdGst] = useState("18")
  const [newProdCp, setNewProdCp] = useState("")
  const [newProdSp, setNewProdSp] = useState("")
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)

  if (!forceOpen) return null

  const handleCreateProduct = async () => {
    if (!newProdDesc.trim()) {
      sileo.warning({
        title: "Description Required",
        description: "Please enter a material description for the new product.",
      })
      return
    }
    setIsCreatingProduct(true)
    try {
      const res = await createQuickProduct({
        materialCode: newProdCode,
        materialDescription: newProdDesc,
        unit: newProdUnit,
        gstRate: parseFloat(newProdGst) || 18,
        costPrice: parseFloat(newProdCp) || 0,
        sellingPrice: parseFloat(newProdSp) || 0,
      })
      if (res.success && res.product) {
        sileo.success({
          title: "Product Added to Catalog",
          description: `${res.product.materialDescription} (${res.product.materialCode}) has been created.`,
        })
        setNewProdCode("")
        setNewProdDesc("")
        setNewProdUnit("NUM")
        setNewProdGst("18")
        setNewProdCp("")
        setNewProdSp("")
        if (onSuccess) onSuccess(res.product)
        onForceClose()
      } else {
        sileo.error({
          title: "Failed to Create Product",
          description: res.error || "Could not create product.",
        })
      }
    } catch {
      sileo.error({
        title: "Failed to Create Product",
        description: "An unexpected error occurred.",
      })
    } finally {
      setIsCreatingProduct(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-orange-600" />
            <h3 className="text-base font-bold text-slate-900">Quick Add Catalog Product</h3>
          </div>
          <button
            type="button"
            onClick={onForceClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Material Code (Optional)
            </label>
            <input
              value={newProdCode}
              onChange={(e) => setNewProdCode(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              placeholder="Auto-generated if left blank"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Material Description *
            </label>
            <input
              autoFocus
              value={newProdDesc}
              onChange={(e) => setNewProdDesc(e.target.value)}
              placeholder="e.g., Pressure Gauge 0-10 Bar SS316"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Cost Price (₹)
              </label>
              <SmartNumberInput
                value={newProdCp}
                onValueChange={(val, rawStr) =>
                  setNewProdCp(rawStr === "" ? "" : String(val))
                }
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                Selling Price (₹)
              </label>
              <SmartNumberInput
                value={newProdSp}
                onValueChange={(val, rawStr) =>
                  setNewProdSp(rawStr === "" ? "" : String(val))
                }
                placeholder="0.00"
                className="w-full bg-white border border-emerald-300 rounded-lg px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Unit (UOM)
              </label>
              <input
                value={newProdUnit}
                onChange={(e) => setNewProdUnit(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                GST %
              </label>
              <input
                type="number"
                value={newProdGst}
                onChange={(e) => setNewProdGst(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateProduct}
            disabled={isCreatingProduct || !newProdDesc.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors mt-2 cursor-pointer"
          >
            {isCreatingProduct ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <span className="text-white">Create & Select Product</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
