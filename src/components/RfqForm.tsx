"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { upsertDraftRfq, getRfqUpdatedAt } from "@/app/actions/rfq"
import { createSupplier } from "@/app/actions/supplier"
import { parseQuotationExcelAction } from "@/app/actions/import"
import { formatRupee, numberToWordsRupees } from "@/lib/utils"
import { Loader2, Plus, Trash2, Upload, X, Check, AlertCircle, Search } from "lucide-react"
import { verifyGSTAction } from "@/app/actions/gst"

type Supplier = { id: string, name: string }
type Product = { id: string, materialCode: string, materialDescription: string, sellingPrice: number, costPrice: number, gstRate: number, unit: string, specification?: string | null }

export function RfqForm({ suppliers: initialSuppliers, products, initialData, initialUpdatedAt }: { suppliers: Supplier[], products: Product[], initialData?: any, initialUpdatedAt?: Date }) {
  const router = useRouter()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rfqId, setRfqId] = useState(initialData?.id || "")
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE")
  const [conflictDetected, setConflictDetected] = useState(false)
  const expectedUpdatedAt = useRef<Date | undefined>(initialUpdatedAt)
  
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialData?.supplierId || "")
  const [items, setItems] = useState<{ 
    product: Product, 
    quantity: number, 
    cpSnapshot: number,
    comment?: string
  }[]>(initialData?.items?.map((item: any) => ({
    product: item.product,
    quantity: item.quantity,
    cpSnapshot: item.cpSnapshot || 0,
    comment: item.comment || undefined
  })) || [])
  
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

  const [newSupplierGst, setNewSupplierGst] = useState("")
  const [newSupplierLocation, setNewSupplierLocation] = useState("")
  
  const [isVerifyingGST, setIsVerifyingGST] = useState(false)
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
        alert("Details fetched successfully! \n" + (res.data.legalName ? "(" + res.data.legalName + ")" : ""));
      }
    } catch (e) {
      alert("Failed to verify GST.");
    } finally {
      setIsVerifyingGST(false);
    }
  }


  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (!rfqId || conflictDetected) return

    const interval = setInterval(async () => {
      try {
        const res = await getRfqUpdatedAt(rfqId)
        if (res.success && res.updatedAt && expectedUpdatedAt.current) {
          if (new Date(res.updatedAt).getTime() > new Date(expectedUpdatedAt.current).getTime()) {
            setConflictDetected(true)
          }
        }
      } catch (e) {
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [rfqId, conflictDetected])

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return
    setIsCreatingSupplier(true)
    try {
      const res = await createSupplier({ name: newSupplierName, contact: newSupplierContact })
      if (res.success && res.supplier) {
        setSuppliers(prev => [...prev, res.supplier].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedSupplierId(res.supplier.id)
        setIsSupplierModalOpen(false)
        setNewSupplierName("")
        setNewSupplierContact("")
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
        addProductToRfq(filteredProducts[highlightedIndex])
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false)
    }
  }

  const addProductToRfq = (product: Product, quantity = 1) => {
    setItems(prev => {
      if (prev.find(i => i.product.id === product.id)) return prev
      return [...prev, { 
        product, 
        quantity, 
        cpSnapshot: product.costPrice || 0
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
    setItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    ))
  }

  const handleCpChange = (productId: string, cp: number) => {
    setItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, cpSnapshot: cp } : item
    ))
  }

  const handleCommentChange = (productId: string, comment: string) => {
    setItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, comment } : item
    ))
  }

  const handleProductChange = (productId: string, field: 'materialCode' | 'materialDescription' | 'unit' | 'gstRate', value: any) => {
    setItems(items.map(i => i.product.id === productId ? { 
      ...i, 
      product: { ...i.product, [field]: value } 
    } : i))
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await parseQuotationExcelAction(formData) // we can reuse this action as it just parses products
      
      if (result.success && result.parsedItems) {
        setItems(prev => {
          const newItems = [...prev]
          result.parsedItems.forEach((parsed: any) => {
            if (!newItems.find(i => i.product.id === parsed.product.id)) {
              newItems.push({
                product: parsed.product,
                quantity: parsed.quantity,
                cpSnapshot: 0
              })
            }
          })
          return newItems
        })
      } else {
        alert(result.error || "Failed to parse Excel")
      }
    } catch (e: any) {
      alert("Error uploading file")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (status: string) => {
    if (!selectedSupplierId) return alert("Please select a supplier")
    if (items.length === 0) return alert("Please add at least one item")

    setIsSubmitting(true)
    setSaveStatus("SAVING")
    try {
      const payload = {
        id: rfqId || undefined,
        supplierId: selectedSupplierId,
        status,
        expectedUpdatedAt: expectedUpdatedAt.current,
        items: items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          cpSnapshot: item.cpSnapshot ?? 0,
          comment: item.comment
        }))
      }

      const result = await upsertDraftRfq(payload)
      if (result.error) {
        if (result.error.startsWith("CONFLICT")) {
          setConflictDetected(true)
        }
        throw new Error(result.error)
      }

      if (status === "DRAFT") {
        setSaveStatus("SAVED")
        if (!rfqId) {
          setRfqId(result.id)
          window.history.replaceState(null, '', `/rfq/${result.id}/edit`)
        }
        
        if (result.id) {
          const updatedRes = await getRfqUpdatedAt(result.id)
          if (updatedRes.success && updatedRes.updatedAt) {
            expectedUpdatedAt.current = new Date(updatedRes.updatedAt)
          }
        }
        
        router.refresh()
        setTimeout(() => setSaveStatus("IDLE"), 2000)
      } else {
        router.push(`/rfq/${result.id}`)
        router.refresh()
      }
    } catch (error: any) {
      console.error(error)
      alert(error.message || "Something went wrong")
      setSaveStatus("ERROR")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {conflictDetected && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-md flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-rose-500">Conflict Detected: New Updates Available</h3>
            <p className="text-sm text-rose-400 mt-1">
              Someone else has modified this RFQ since you opened it. Saving now would overwrite their changes.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              Reload to see latest changes
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end text-sm h-5">
        {saveStatus === "SAVING" && <span className="text-zinc-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Saving draft...</span>}
        {saveStatus === "SAVED" && <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3"/> Draft saved</span>}
        {saveStatus === "ERROR" && <span className="text-rose-500">Failed to save draft</span>}
      </div>

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
                  placeholder="Acme Vendor Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Location / Address</label>
                <input 
                  value={newSupplierLocation}
                  onChange={e => setNewSupplierLocation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
                  placeholder="City, State, etc."
                />
              </div>
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
                  placeholder="Acme Vendor Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Location / Address</label>
                <input 
                  value={newSupplierLocation}
                  onChange={e => setNewSupplierLocation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
                  placeholder="City, State, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Contact (Email/Phone)</label>
                <input 
                  value={newSupplierContact}
                  onChange={e => setNewSupplierContact(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
                  placeholder="vendor@acme.com"
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
              title="Add New Supplier"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Purchase Items</h2>
          <div>
            <input 
              type="file" 
              accept=".xlsx,.xls" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleExcelUpload}
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white font-medium rounded-md transition-colors text-sm border border-premium-border active:scale-95"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Items (Excel)
            </button>
          </div>
        </div>
        
        <div className="relative" ref={autocompleteRef}>
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
              className="flex-1 bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate shadow-lg shadow-black/20"
            />
          </div>
          
          {isDropdownOpen && searchTerm && (
            <ul className="absolute z-10 mt-2 w-full glass-panel border border-premium-border rounded-md shadow-2xl max-h-60 overflow-y-auto custom-scrollbar overflow-x-hidden animate-in fade-in slide-in-from-top-2">
              {filteredProducts.length === 0 ? (
                <li className="px-4 py-3 text-zinc-500 text-sm">No products found.</li>
              ) : (
                filteredProducts.map((p, idx) => (
                  <li 
                    key={p.id}
                    onClick={() => addProductToRfq(p)}
                    className={`px-4 py-3 cursor-pointer border-b border-premium-border last:border-0 hover:bg-white/5 transition-colors ${highlightedIndex === idx ? 'bg-white/5' : ''}`}
                  >
                    <div className="text-sm font-medium text-white">{p.materialCode}</div>
                    <div className="text-xs text-zinc-400 truncate">{p.materialDescription}</div>
                    {p.specification && <div className="text-[10px] text-zinc-500 truncate mt-0.5">{p.specification}</div>}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-4 mt-4">
            {items.map((item) => {
              const cp = item.cpSnapshot ?? 0
              const isPending = !cp
              
              return (
                <div key={item.product.id} className="glass-panel border border-premium-border rounded-lg p-5 group hover:bg-white/[0.03] transition-colors relative">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <input 
                          type="text"
                          value={item.product.materialCode}
                          onChange={e => handleProductChange(item.product.id, 'materialCode', e.target.value)}
                          placeholder="Code"
                          className="w-32 bg-zinc-950/50 border border-transparent hover:border-premium-border focus:border-brand-slate px-2 py-1 font-mono text-sm text-white focus:outline-none transition-colors rounded"
                        />
                        <input 
                          type="text"
                          value={item.product.materialDescription}
                          onChange={e => handleProductChange(item.product.id, 'materialDescription', e.target.value)}
                          placeholder="Description"
                          className="flex-1 bg-zinc-950/50 border border-transparent hover:border-premium-border focus:border-brand-slate px-2 py-1 text-sm font-medium text-white focus:outline-none transition-colors rounded"
                        />
                        {isPending && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-rose-500/10 text-rose-400 px-2 py-1 rounded border border-rose-500/20">
                            <AlertCircle className="w-3 h-3" /> Price Pending
                          </span>
                        )}
                      </div>
                      
                      {item.product.specification && (
                        <div className="text-xs text-zinc-500 px-2 line-clamp-2">
                          {item.product.specification}
                        </div>
                      )}
                      
                      <div>
                        <input
                          type="text"
                          placeholder="Add note (optional)..."
                          value={item.comment || ""}
                          onChange={(e) => handleCommentChange(item.product.id, e.target.value)}
                          className="w-full bg-zinc-950/30 border border-transparent hover:border-premium-border focus:border-brand-slate px-2 py-1.5 text-xs text-brand-slate focus:text-white rounded focus:outline-none transition-colors placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={() => handleRemoveItem(item.product.id)}
                      className="text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 p-2 rounded-md transition-all active:scale-95"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-premium-border/30">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Quantity</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={e => handleQuantityChange(item.product.id, parseFloat(e.target.value) || 0)}
                          className="w-20 bg-zinc-950 border border-premium-border rounded px-2 py-1.5 text-white font-medium focus:outline-none focus:ring-1 focus:ring-brand-slate"
                        />
                        <input 
                          type="text"
                          value={item.product.unit}
                          onChange={e => handleProductChange(item.product.id, 'unit', e.target.value)}
                          className="w-14 bg-zinc-950/50 border border-transparent hover:border-premium-border focus:border-brand-slate px-1 py-1.5 font-mono text-xs text-zinc-400 text-center focus:outline-none transition-colors rounded uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Cost Price / Unit</label>
                      <div className="relative w-full max-w-[120px]">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">₹</span>
                        <input 
                          type="number"
                          min="0" step="any"
                          value={cp ? cp / 100 : ''}
                          onChange={e => handleCpChange(item.product.id, Math.round(parseFloat(e.target.value) * 100) || 0)}
                          placeholder="Price"
                          className="w-full bg-zinc-950 border border-premium-border rounded pl-5 pr-2 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-brand-slate transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Total Value</label>
                      <div className="text-sm font-mono font-bold text-emerald-500 pt-1.5">
                        {formatRupee(cp * item.quantity)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">GST Rate</label>
                      <div className="flex items-center">
                        <input 
                          type="number"
                          value={item.product.gstRate}
                          onChange={e => handleProductChange(item.product.id, 'gstRate', parseFloat(e.target.value) || 0)}
                          className="w-14 bg-zinc-950/50 border border-transparent hover:border-premium-border focus:border-brand-slate px-2 py-1.5 text-sm text-white focus:outline-none transition-colors rounded"
                        />
                        <span className="text-zinc-500 text-xs ml-2">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-t border-premium-border/50 p-4 md:px-8 flex flex-col md:flex-row items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-4">
          <div className="flex flex-wrap items-center gap-6 md:gap-12 mb-4 md:mb-0">
            {(() => {
              const totalAmount = items.reduce((sum, item) => sum + Math.round((item.cpSnapshot || 0) * item.quantity), 0);
              const totalGst = items.reduce((sum, item) => sum + Math.round(Math.round((item.cpSnapshot || 0) * item.quantity) * (item.product.gstRate / 100)), 0);
              
              return (
                <>
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Subtotal</div>
                    <div className="text-lg font-bold text-white">{formatRupee(totalAmount)}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total GST</div>
                    <div className="text-lg font-bold text-zinc-300">{formatRupee(totalGst)}</div>
                  </div>
                  
                  <div className="hidden md:block w-px h-10 bg-premium-border/50"></div>
                  
                  <div className="space-y-1 flex flex-col items-end">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Grand Total</div>
                    <div className="text-2xl font-black text-brand-orange">{formatRupee(totalAmount + totalGst)}</div>
                    <div className="text-xs text-zinc-400 font-medium">{numberToWordsRupees(totalAmount + totalGst)}</div>
                  </div>
                </>
              );
            })()}
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => handleSubmit("DRAFT")}
              disabled={isSubmitting || saveStatus === "SAVING"}
              className="flex-1 md:flex-none px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-md transition-colors border border-premium-border disabled:opacity-50"
            >
              {saveStatus === "SAVING" ? "Saving..." : "Save Draft"}
            </button>
            <button 
              onClick={() => handleSubmit("ISSUED")}
              disabled={isSubmitting}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {rfqId ? "Update RFQ" : "Issue RFQ"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
