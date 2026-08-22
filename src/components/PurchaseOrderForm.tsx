"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createQuickProduct } from "@/app/actions/product"
import { createPurchaseOrder, updatePurchaseOrder } from "@/app/actions/purchaseOrder"
import { createSupplier } from "@/app/actions/supplier"
import { formatRupee } from "@/lib/utils"
import { Loader2, Plus, Trash2, Upload, X, Check, Search } from "lucide-react"
import { verifyGSTAction } from "@/app/actions/gst"

type Supplier = { id: string, name: string }
type Product = { id: string, materialCode: string, materialDescription: string, sellingPrice: number, costPrice: number, gstRate: number, unit: string, specification?: string | null }

export function PurchaseOrderForm({ suppliers: initialSuppliers, products, initialData }: { suppliers: Supplier[], products: Product[], initialData?: any }) {
  const router = useRouter()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [poId, setPoId] = useState(initialData?.id || "")
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE")
  
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialData?.supplierId || "")
  
  const [paymentTerms, setPaymentTerms] = useState(initialData?.paymentTerms || "")
  const [deliveryTerms, setDeliveryTerms] = useState(initialData?.deliveryTerms || "")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    initialData?.expectedDeliveryDate ? new Date(initialData.expectedDeliveryDate).toISOString().split('T')[0] : ""
  )
  const [notes, setNotes] = useState(initialData?.notes || "")
  const [rfqId, setRfqId] = useState(initialData?.rfqId || "")

  const [items, setItems] = useState<{ 
    product: Product, 
    quantity: number,
    unitPrice: number,
    gstRate: number,
    comment?: string
  }[]>(initialData?.items?.map((item: any) => ({
    product: item.product,
    quantity: item.quantity,
    unitPrice: item.unitPrice / 100,
    gstRate: item.gstRate,
    comment: item.comment || undefined
  })) || [])
  
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

  const [newSupplierGst, setNewSupplierGst] = useState("")
  const [newSupplierLocation, setNewSupplierLocation] = useState("")
  const [isVerifyingGST, setIsVerifyingGST] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdDesc, setNewProdDesc] = useState("")
  const [newProdUnit, setNewProdUnit] = useState("NUM")
  const [newProdGst, setNewProdGst] = useState("18")
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  const handleVerifyGST = async () => {
    if (!newSupplierGst.trim() || newSupplierGst.length < 15) {
      alert("Please enter a valid 15-character GST Number.");
      return;
    }
    setIsVerifyingGST(true);
    try {
      const res = await verifyGSTAction(newSupplierGst.trim());
      if (res.error) {
        alert(res.error);
      } else if (res.data) {
        setNewSupplierName(res.data.name || newSupplierName);
        setNewSupplierLocation(res.data.location || res.data.address || newSupplierLocation);
        alert("Details fetched successfully! \\n" + (res.data.legalName ? "(" + res.data.legalName + ")" : ""));
      }
    } catch (e) {
      alert("Failed to verify GST.");
    } finally {
      setIsVerifyingGST(false);
    }
  }

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return
    setIsCreatingSupplier(true)
    try {
      const res = await createSupplier({ name: newSupplierName, contact: newSupplierContact, gstNumber: newSupplierGst, location: newSupplierLocation })
      if (res.success && res.supplier) {
        setSuppliers(prev => [...prev, res.supplier].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedSupplierId(res.supplier.id)
        setIsSupplierModalOpen(false)
        setNewSupplierName("")
        setNewSupplierContact("")
        setNewSupplierGst("")
        setNewSupplierLocation("")
      } else {
        alert(res.error)
      }
    } catch (e) {
      alert("Failed to create supplier")
    } finally {
      setIsCreatingSupplier(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50)

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
        setIsProductModalOpen(false)
        addProductToPO(res.product)
        setNewProdCode("")
        setNewProdDesc("")
        setNewProdUnit("NUM")
        setNewProdGst("18")
      } else {
        alert(res.error)
      }
    } catch (e) {
      alert("Failed to create product")
    } finally {
      setIsCreatingProduct(false)
    }
  }

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
        addProductToPO(filteredProducts[highlightedIndex])
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false)
    }
  }

  const addProductToPO = (product: Product, quantity = 1, unitPrice = 0) => {
    setItems(prev => {
      if (prev.find(i => i.product.id === product.id)) return prev
      return [...prev, { 
        product, 
        quantity, 
        unitPrice: unitPrice > 0 ? unitPrice : (product.costPrice / 100),
        gstRate: product.gstRate,
      }]
    })
    setSearchTerm("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(i => i.product.id !== productId))
  }

  const handleItemChange = (productId: string, field: 'quantity' | 'unitPrice' | 'gstRate' | 'comment', value: any) => {
    setItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, [field]: value } : item
    ))
  }

  const handleProductChange = (productId: string, field: 'materialCode' | 'materialDescription' | 'unit', value: any) => {
    setItems(items.map(i => i.product.id === productId ? { 
      ...i, 
      product: { ...i.product, [field]: value } 
    } : i))
  }

  const handleSubmit = async (status: string) => {
    if (!selectedSupplierId) return alert("Please select a supplier")
    if (items.length === 0) return alert("Please add at least one item")

    setIsSubmitting(true)
    setSaveStatus("SAVING")
    try {
      const payload = {
        supplierId: selectedSupplierId,
        status,
        paymentTerms,
        deliveryTerms,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        notes,
        rfqId: rfqId || undefined,
        items: items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice * 100), // convert to paise
          gstRate: item.gstRate,
          comment: item.comment
        }))
      }

      let result;
      if (poId) {
         result = await updatePurchaseOrder(poId, payload)
      } else {
         result = await createPurchaseOrder(payload) 
      }
      
      if (result.error) {
        throw new Error(result.error)
      }

      setSaveStatus("SAVED")
      router.push(`/purchase-orders/${result.id || poId}`)
      router.refresh()
    } catch (error: any) {
      console.error(error)
      alert(error.message || "Something went wrong")
      setSaveStatus("ERROR")
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
  const totalGst = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice * (item.gstRate / 100)), 0)

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-end text-sm h-5">
        {saveStatus === "SAVING" && <span className="text-zinc-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Saving...</span>}
        {saveStatus === "SAVED" && <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3"/> Saved</span>}
        {saveStatus === "ERROR" && <span className="text-rose-500">Failed to save</span>}
      </div>

      
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-md border border-premium-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">New Product</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
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
                onClick={handleCreateProduct} disabled={isCreatingProduct || !newProdDesc.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-md transition-colors mt-4"
              >
                {isCreatingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create & Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-md border border-premium-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">New Supplier</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">GST Number</label>
                <div className="flex gap-2">
                  <input 
                    value={newSupplierGst}
                    onChange={e => setNewSupplierGst(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate uppercase" 
                    placeholder="e.g. 22AAAAA0000A1Z5"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyGST}
                    disabled={isVerifyingGST}
                    className="flex items-center gap-1 px-3 py-2 bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 disabled:opacity-50 rounded-md transition-colors"
                  >
                    {isVerifyingGST ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="text-xs font-semibold whitespace-nowrap">Verify</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Supplier Name *</label>
                <input 
                  autoFocus
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Location / Address</label>
                <input 
                  value={newSupplierLocation}
                  onChange={e => setNewSupplierLocation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Contact</label>
                <input 
                  value={newSupplierContact}
                  onChange={e => setNewSupplierContact(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
                />
              </div>
              <button 
                onClick={handleCreateSupplier}
                disabled={isCreatingSupplier || !newSupplierName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-md transition-colors mt-4"
              >
                {isCreatingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-2">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Supplier *</label>
          <div className="flex gap-2">
            <select 
              value={selectedSupplierId} 
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            >
              <option value="">Select a Supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button 
              type="button"
              onClick={() => setIsSupplierModalOpen(true)}
              className="px-3 bg-white/5 hover:bg-white/10 text-white rounded-md border border-premium-border transition-colors active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">RFQ Reference (Optional)</label>
          <input 
            type="text"
            value={rfqId}
            onChange={e => setRfqId(e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            placeholder="RFQ ID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Expected Delivery Date</label>
          <input 
            type="date"
            value={expectedDeliveryDate}
            onChange={e => setExpectedDeliveryDate(e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Payment Terms</label>
          <input 
            type="text"
            value={paymentTerms}
            onChange={e => setPaymentTerms(e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            placeholder="e.g. Net 30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Delivery Terms</label>
          <input 
            type="text"
            value={deliveryTerms}
            onChange={e => setDeliveryTerms(e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            placeholder="e.g. Ex-works"
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-zinc-400 mb-1">Notes</label>
          <textarea 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate min-h-[80px]"
            placeholder="Additional notes for PO..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium text-white">Purchase Items</h2>
        
        <div className="relative z-[55]" ref={autocompleteRef}>
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
            placeholder="Search products..."
            className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate shadow-lg"
          />
          
          {isDropdownOpen && searchTerm && (
            <ul className="absolute z-[60] mt-2 w-full glass-panel border border-premium-border rounded-md shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in">
              {filteredProducts.length === 0 ? (
                <li className="px-4 py-3 text-zinc-500 text-sm">No products found.</li>
              ) : (
                filteredProducts.map((p, idx) => (
                  <li 
                    key={p.id}
                    onClick={() => addProductToPO(p)}
                    className={`px-4 py-3 cursor-pointer border-b border-premium-border hover:bg-white/5 ${highlightedIndex === idx ? 'bg-white/5' : ''}`}
                  >
                    <div className="text-sm font-medium text-white">{p.materialCode}</div>
                    <div className="text-xs text-zinc-400 truncate">{p.materialDescription}</div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-4 mt-4">
            {items.map((item) => (
              <div key={item.product.id} className="glass-panel border border-premium-border rounded-lg p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <input 
                        type="text"
                        value={item.product.materialCode}
                        onChange={e => handleProductChange(item.product.id, 'materialCode', e.target.value)}
                        className="w-32 bg-zinc-950/50 border border-transparent hover:border-premium-border focus:border-brand-slate px-2 py-1 font-mono text-sm text-white rounded"
                      />
                      <input 
                        type="text"
                        value={item.product.materialDescription}
                        onChange={e => handleProductChange(item.product.id, 'materialDescription', e.target.value)}
                        className="flex-1 bg-zinc-950/50 border border-transparent hover:border-premium-border focus:border-brand-slate px-2 py-1 text-sm font-medium text-white rounded"
                      />
                    </div>
                    
                    <div>
                      <input
                        type="text"
                        placeholder="Add note..."
                        value={item.comment || ""}
                        onChange={(e) => handleItemChange(item.product.id, 'comment', e.target.value)}
                        className="w-full bg-zinc-950/30 border border-transparent hover:border-premium-border focus:border-brand-slate px-2 py-1.5 text-xs text-brand-slate focus:text-white rounded"
                      />
                    </div>
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={() => handleRemoveItem(item.product.id)}
                    className="text-zinc-500 hover:text-rose-500 p-2 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-premium-border/30">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Quantity</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" min="0" step="any"
                        value={item.quantity}
                        onChange={e => handleItemChange(item.product.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full bg-zinc-950 border border-premium-border rounded px-2 py-1.5 text-white font-medium focus:ring-1 focus:ring-brand-slate"
                      />
                      <span className="text-xs text-zinc-400">{item.product.unit}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Unit Price (₹)</label>
                    <input 
                      type="number" min="0" step="any"
                      value={item.unitPrice}
                      onChange={e => handleItemChange(item.product.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-premium-border rounded px-2 py-1.5 text-white font-medium focus:ring-1 focus:ring-brand-slate"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">GST Rate (%)</label>
                    <input 
                      type="number" min="0" step="any"
                      value={item.gstRate}
                      onChange={e => handleItemChange(item.product.id, 'gstRate', parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-premium-border rounded px-2 py-1.5 text-white font-medium focus:ring-1 focus:ring-brand-slate"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Total (₹)</label>
                    <div className="px-2 py-1.5 text-white font-medium">
                      {formatRupee((item.quantity * item.unitPrice * 100))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-t border-premium-border/50 p-4 md:px-8 flex flex-col md:flex-row items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-6 mb-4 md:mb-0 text-sm">
            <div>
              <span className="text-zinc-400">Total Amount:</span>
              <span className="ml-2 text-white font-medium">{formatRupee(totalAmount * 100)}</span>
            </div>
            <div>
              <span className="text-zinc-400">GST:</span>
              <span className="ml-2 text-brand-slate font-medium">{formatRupee(totalGst * 100)}</span>
            </div>
            <div>
              <span className="text-zinc-400">Grand Total:</span>
              <span className="ml-2 text-white font-bold text-lg">{formatRupee((totalAmount + totalGst) * 100)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => handleSubmit("DRAFT")}
              disabled={isSubmitting}
              className="flex-1 md:flex-none px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-md transition-colors border border-premium-border disabled:opacity-50"
            >
              Save Draft
            </button>
            <button 
              onClick={() => handleSubmit("ISSUED")}
              disabled={isSubmitting}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 bg-gradient-to-r from-brand-orange to-brand-orange-dark text-white font-medium rounded-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {poId ? "Update PO" : "Create PO"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
