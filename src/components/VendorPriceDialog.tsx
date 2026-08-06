"use client"
import { useState, useEffect } from "react"
import { Loader2, X, Plus, Check } from "lucide-react"
import { getProductSuppliers, addProductSupplier, updateProductSupplierPrice } from "@/app/actions/supplier"
import { Edit2 } from "lucide-react"

type ProductSupplier = {
  id: string
  productId: string
  supplierId: string
  costPrice: number
  supplier: { id: string, name: string }
}

export function VendorPriceDialog({ 
  productId, 
  productName,
  currentCp,
  currentSp,
  onSave, 
  onClose 
}: { 
  productId: string
  productName: string
  currentCp?: number
  currentSp?: number
  onSave: (cp: number, sp: number, supplierId: string) => void
  onClose: () => void 
}) {
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Selection state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [selectedCp, setSelectedCp] = useState<number | "">("")
  const [spInput, setSpInput] = useState<number | "">(currentSp ? currentSp / 100 : "")

  // New Supplier State
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierCp, setNewSupplierCp] = useState<number | "">("")
  const [isSavingNew, setIsSavingNew] = useState(false)

  // Edit Supplier State
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [editSupplierCp, setEditSupplierCp] = useState<number | "">("")
  const [isUpdatingCp, setIsUpdatingCp] = useState(false)

  useEffect(() => {
    async function fetchSuppliers() {
      const res = await getProductSuppliers(productId)
      if (res.data) {
        setSuppliers(res.data)
        // Auto-select if we already have a CP
        if (currentCp) {
          const match = res.data.find((s: ProductSupplier) => s.costPrice === currentCp)
          if (match) {
            setSelectedSupplierId(match.supplierId)
            setSelectedCp(match.costPrice)
          } else {
            setSelectedCp(currentCp)
          }
        } else if (res.data.length > 0) {
          setSelectedSupplierId(res.data[0].supplierId)
          setSelectedCp(res.data[0].costPrice)
        }
      }
      setIsLoading(false)
    }
    fetchSuppliers()
  }, [productId, currentCp])

  const handleAddNewSupplier = async () => {
    if (!newSupplierName.trim() || !newSupplierCp) return
    setIsSavingNew(true)
    const res = await addProductSupplier(productId, newSupplierName, Number(newSupplierCp))
    if (res.success && res.data) {
      setSuppliers([...suppliers, res.data as ProductSupplier].sort((a,b) => a.costPrice - b.costPrice))
      setSelectedSupplierId((res.data as ProductSupplier).supplierId)
      setSelectedCp((res.data as ProductSupplier).costPrice)
      setIsAddingNew(false)
      setNewSupplierName("")
      setNewSupplierCp("")
    } else {
      alert(res.error || "Failed to add supplier")
    }
    setIsSavingNew(false)
  }

  const handleUpdateSupplierCp = async (supplierId: string) => {
    if (!editSupplierCp) return
    setIsUpdatingCp(true)
    const res = await updateProductSupplierPrice(productId, supplierId, Number(editSupplierCp))
    if (res.success && res.data) {
      const updatedCp = (res.data as ProductSupplier).costPrice
      setSuppliers(suppliers.map(s => s.supplierId === supplierId ? { ...s, costPrice: updatedCp } : s).sort((a,b) => a.costPrice - b.costPrice))
      if (selectedSupplierId === supplierId) {
        setSelectedCp(updatedCp)
      }
      setEditingSupplierId(null)
      setEditSupplierCp("")
    } else {
      alert(res.error || "Failed to update supplier price")
    }
    setIsUpdatingCp(false)
  }

  const handleSave = () => {
    if (!selectedSupplierId || !selectedCp) {
      alert("Please select or add a supplier price (CP).")
      return
    }
    if (!spInput) {
      alert("Please enter a Selling Price (SP).")
      return
    }
    onSave(Number(selectedCp), Math.round(Number(spInput) * 100), selectedSupplierId)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-premium-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium text-white">Vendor Prices</h3>
            <p className="text-sm text-zinc-400">{productName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Existing Suppliers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-zinc-400">Available Suppliers (CP)</label>
                {!isAddingNew && (
                  <button onClick={() => setIsAddingNew(true)} className="text-xs text-brand-orange hover:text-orange-400 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add New
                  </button>
                )}
              </div>
              
              {isAddingNew ? (
                <div className="bg-white/5 p-4 rounded-xl border border-premium-border space-y-3">
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Supplier Name"
                    value={newSupplierName}
                    onChange={e => setNewSupplierName(e.target.value)}
                    className="w-full bg-zinc-950 border border-premium-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                  />
                  <div className="flex gap-2 items-center">
                    <span className="text-zinc-400 text-sm">₹</span>
                    <input 
                      type="number"
                      placeholder="Cost Price (CP)"
                      value={newSupplierCp}
                      onChange={e => setNewSupplierCp(e.target.value === "" ? "" : Number(e.target.value))}
                      className="flex-1 bg-zinc-950 border border-premium-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    />
                  </div>
                  <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => setIsAddingNew(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white">Cancel</button>
                    <button 
                      onClick={handleAddNewSupplier} 
                      disabled={isSavingNew || !newSupplierName || !newSupplierCp}
                      className="px-3 py-1.5 text-xs bg-brand-orange hover:bg-orange-600 text-white rounded-md disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSavingNew && <Loader2 className="w-3 h-3 animate-spin"/>} Save Vendor
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {suppliers.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic">No vendors found for this product.</p>
                  ) : (
                    suppliers.map((s: ProductSupplier) => (
                      <div 
                        key={s.id}
                        onClick={() => {
                          setSelectedSupplierId(s.supplierId)
                          setSelectedCp(s.costPrice)
                        }}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSupplierId === s.supplierId 
                            ? 'bg-brand-orange/10 border-brand-orange/50 text-white shadow-lg shadow-brand-orange/5' 
                            : 'bg-white/5 border-premium-border text-zinc-400 hover:border-brand-slate hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedSupplierId === s.supplierId ? 'border-brand-orange bg-brand-orange text-white' : 'border-zinc-600'}`}>
                            {selectedSupplierId === s.supplierId && <Check className="w-3 h-3" />}
                          </div>
                          <span className="font-medium text-sm">{s.supplier.name}</span>
                        </div>
                        {editingSupplierId === s.supplierId ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <span className="text-zinc-500 text-sm">₹</span>
                            <input 
                              type="number"
                              autoFocus
                              value={editSupplierCp}
                              onChange={e => setEditSupplierCp(e.target.value === "" ? "" : Number(e.target.value))}
                              className="bg-zinc-950 border border-brand-orange rounded px-2 py-1 text-sm text-white w-24 focus:outline-none focus:ring-1 focus:ring-brand-orange"
                            />
                            <button 
                              onClick={() => handleUpdateSupplierCp(s.supplierId)}
                              disabled={isUpdatingCp || !editSupplierCp}
                              className="p-1 bg-brand-orange hover:bg-orange-600 text-white rounded transition-colors disabled:opacity-50"
                            >
                              {isUpdatingCp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </button>
                            <button 
                              onClick={() => { setEditingSupplierId(null); setEditSupplierCp(""); }}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm">₹{(s.costPrice / 100).toFixed(2)}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSupplierId(s.supplierId)
                                setEditSupplierCp(s.costPrice / 100)
                              }}
                              className="text-zinc-500 hover:text-white transition-colors"
                              title="Edit Vendor Price"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-premium-border w-full" />

            {/* Selling Price */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Final Selling Price (SP)</label>
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-xl font-light">₹</span>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={spInput}
                  onChange={e => setSpInput(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-3 text-lg text-white font-mono focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              {selectedCp && spInput && (
                <p className="text-xs mt-2 text-zinc-500 flex justify-between">
                  <span>Margin:</span>
                  <span className={Number(spInput) * 100 > Number(selectedCp) ? 'text-emerald-500' : 'text-rose-500'}>
                    ₹{((Number(spInput) * 100 - Number(selectedCp)) / 100).toFixed(2)}
                    {' '}
                    ({(((Number(spInput) * 100 - Number(selectedCp)) / Number(selectedCp)) * 100).toFixed(1)}%)
                  </span>
                </p>
              )}
            </div>

            <button 
              onClick={handleSave}
              className="w-full py-3 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-lg transition-all active:scale-95"
            >
              Confirm Prices
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
