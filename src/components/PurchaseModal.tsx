"use client"
import { useState, useRef, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { createPurchase, updatePurchase } from "@/app/actions/purchase"
import { Loader2, X, Plus, Search, Trash2 } from "lucide-react"
import { formatRupee } from "@/lib/utils"
import { SupplierModal } from "./SupplierModal"

type Supplier = { id: string, name: string }
type Product = { id: string, materialCode: string, materialDescription: string, costPrice: number }

export function PurchaseModal({ 
  suppliers, 
  products,
  purchases,
  quotations
}: { 
  suppliers: Supplier[]
  products: Product[]
  purchases?: any[]
  quotations?: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const action = searchParams.get("action")
  const editId = searchParams.get("id")

  const isEditing = action === "edit-purchase"
  const purchaseToEdit = isEditing && purchases ? purchases.find(p => p.id === editId) : null

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [selectedQuotationId, setSelectedQuotationId] = useState("")
  const [items, setItems] = useState<{ 
    product: Product, 
    quantity: number, 
    cpSnapshot: number 
  }[]>([])

  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers)
  const [showSupplierModal, setShowSupplierModal] = useState(false)

  useEffect(() => {
    setLocalSuppliers(suppliers)
  }, [suppliers])

  const handleClose = () => {
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.delete("action")
    newParams.delete("id")
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false })
  }

  const handleQuotationChange = (qId: string) => {
    setSelectedQuotationId(qId)
    if (!qId) return
    const q = quotations?.find(x => x.id === qId)
    if (q && q.items) {
      const newItems = q.items.map((qi: any) => ({
        product: qi.product,
        quantity: qi.quantity,
        cpSnapshot: qi.cpSnapshot || qi.product.costPrice || 0
      }))
      setItems(newItems)
    }
  }

  useEffect(() => {
    if (action === "new-purchase") {
      setSelectedSupplierId("")
      setSelectedQuotationId("")
      setItems([])
      setSearchTerm("")
    } else if (purchaseToEdit) {
      setSelectedSupplierId(purchaseToEdit.supplierId || "")
      setSelectedQuotationId(purchaseToEdit.quotationId || "")
      setItems(purchaseToEdit.items.map((item: any) => ({
        product: item.product,
        quantity: item.quantity,
        cpSnapshot: item.cpSnapshot
      })))
      setSearchTerm("")
    }
  }, [action, purchaseToEdit])

  // Autocomplete
  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  const filteredProducts = products.filter(p => 
    p.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") setIsDropdownOpen(true)
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
        addProductToPurchase(filteredProducts[highlightedIndex])
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false)
    }
  }

  const addProductToPurchase = (product: Product, quantity = 1) => {
    setItems(prev => {
      if (prev.find(i => i.product.id === product.id)) return prev
      return [...prev, { 
        product, 
        quantity, 
        cpSnapshot: product.costPrice
      }]
    })
    setSearchTerm("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(i => i.product.id !== productId))
  }

  const handleQuantityChange = (productId: string, quantity: number) => {
    setItems(items.map(i => i.product.id === productId ? { ...i, quantity } : i))
  }

  const handleCpChange = (productId: string, cpStr: string) => {
    const cp = Number(cpStr) * 100 // convert to paise
    setItems(items.map(i => i.product.id === productId ? { ...i, cpSnapshot: cp } : i))
  }

  const handleSubmit = async () => {
    if (!selectedSupplierId) return alert("Please select a supplier")
    if (items.length === 0) return alert("Please add at least one item")
    if (items.some(i => !i.cpSnapshot || i.cpSnapshot <= 0)) return alert("All items must have a valid cost price (CP)")

    setIsSubmitting(true)
    try {
      const payload = {
        supplierId: selectedSupplierId,
        quotationId: selectedQuotationId || undefined,
        items: items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          cpSnapshot: i.cpSnapshot
        }))
      }

      const res = isEditing && editId
        ? await updatePurchase(editId, payload)
        : await createPurchase(payload)

      if (res.success) {
        router.refresh()
        handleClose()
      } else {
        alert(res.error)
      }
    } catch (e: any) {
      alert("Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (action !== "new-purchase" && action !== "edit-purchase") return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal Content */}
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col rounded-md border border-premium-border shadow-2xl relative z-10 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-premium-border">
          <div>
            <h3 className="text-xl font-medium text-white">{isEditing ? "Edit Purchase" : "Record Purchase"}</h3>
            <p className="text-sm text-zinc-400 mt-1">{isEditing ? "Update an existing purchase." : "Add stock from a supplier."}</p>
          </div>
          <button onClick={handleClose} className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-[400px]">
          {/* Supplier Select */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Select Supplier *</label>
              <div className="flex items-center gap-2">
                <select 
                  value={selectedSupplierId} 
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
                >
                  <option value="">Select a Supplier</option>
                  {localSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="p-2 bg-zinc-900 border border-premium-border rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Add New Supplier"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Tag Quotation (Optional)</label>
              <select 
                value={selectedQuotationId} 
                onChange={e => handleQuotationChange(e.target.value)}
                className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
              >
                <option value="">-- No Quotation Tagged --</option>
                {quotations?.map((q: any) => (
                  <option key={q.id} value={q.id}>{q.prNo || q.id.slice(0,8)} - {q.client.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-px bg-premium-border w-full" />

          {/* Autocomplete */}
          <div className="relative" ref={autocompleteRef}>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Add Product *</label>
            <div className="flex items-center gap-4">
              <input 
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setIsDropdownOpen(true)
                  setHighlightedIndex(-1)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search products by code or description..."
                className="flex-1 max-w-md bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate shadow-lg shadow-black/20"
              />
            </div>
            
            {isDropdownOpen && searchTerm && (
              <ul className="absolute z-10 mt-2 w-full max-w-md glass-panel border border-premium-border rounded-md shadow-2xl max-h-60 overflow-y-auto custom-scrollbar overflow-x-hidden animate-in fade-in slide-in-from-top-2">
                {filteredProducts.length === 0 ? (
                  <li className="px-4 py-3 text-zinc-500 text-sm">No products found.</li>
                ) : (
                  filteredProducts.map((p, idx) => (
                    <li 
                      key={p.id}
                      onClick={() => addProductToPurchase(p)}
                      className={`px-4 py-3 cursor-pointer border-b border-premium-border last:border-0 hover:bg-white/5 transition-colors ${highlightedIndex === idx ? 'bg-white/5' : ''}`}
                    >
                      <div className="text-sm font-medium text-white">{p.materialCode}</div>
                      <div className="text-xs text-zinc-400 truncate">{p.materialDescription}</div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="glass-panel border border-premium-border rounded-md overflow-hidden mt-4">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 w-32">Qty</th>
                    <th className="px-4 py-3 w-40">Unit CP (₹)</th>
                    <th className="px-4 py-3 text-right">Total (₹)</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-premium-border">
                  {items.map((item) => (
                    <tr key={item.product.id} className="hover:bg-white/5 even:bg-white/[0.02] transition-colors group">
                      <td className="px-4 py-3 text-white font-mono text-xs">{item.product.materialCode}</td>
                      <td className="px-4 py-3 text-zinc-300">{item.product.materialDescription}</td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          min="1"
                          value={item.quantity}
                          onChange={e => handleQuantityChange(item.product.id, parseInt(e.target.value) || 1)}
                          className="w-full bg-zinc-950 border border-premium-border rounded px-2 py-1 text-white text-center focus:outline-none focus:ring-1 focus:ring-brand-slate"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={item.cpSnapshot / 100}
                          onChange={e => handleCpChange(item.product.id, e.target.value)}
                          className="w-full bg-zinc-950 border border-premium-border rounded px-2 py-1 text-white text-right focus:outline-none focus:ring-1 focus:ring-brand-slate"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-bold text-emerald-500">
                            {formatRupee(item.cpSnapshot * item.quantity)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="text-rose-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-white/5 border-t border-premium-border flex justify-end">
                <div className="flex gap-12">
                  <div>
                    <div className="text-xs text-zinc-500 font-bold tracking-wider mb-1">TOTAL AMOUNT</div>
                    <div className="text-2xl font-black text-emerald-500">
                      {formatRupee(items.reduce((sum, item) => sum + (item.cpSnapshot * item.quantity), 0))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-premium-border flex justify-end gap-3 bg-zinc-950/50">
          <button 
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-md transition-colors border border-premium-border disabled:opacity-50 active:scale-95"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || items.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? "Update Purchase" : "Confirm Purchase"}
          </button>
        </div>
      </div>

      <SupplierModal 
        forceOpen={showSupplierModal} 
        onForceClose={() => setShowSupplierModal(false)}
        onSuccess={(newSupplier: any) => {
          setLocalSuppliers(prev => [...prev, newSupplier])
          setSelectedSupplierId(newSupplier.id)
          setShowSupplierModal(false)
        }} 
      />
    </div>
  )
}

