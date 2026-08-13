"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { upsertDraftQuotation, getQuotationUpdatedAt } from "@/app/actions/quotation"
import { createClient } from "@/app/actions/client"
import { parseQuotationExcelAction } from "@/app/actions/import"
import { VendorPriceDialog } from "./VendorPriceDialog"
import { Loader2, Plus, Trash2, Upload, X, Check, AlertCircle } from "lucide-react"

type Client = { id: string, name: string }
type Product = { id: string, materialCode: string, materialDescription: string, sellingPrice: number, gstRate: number, unit: string, specification?: string | null }


export function QuotationForm({ clients: initialClients, products, initialData, initialUpdatedAt }: { clients: Client[], products: Product[], initialData?: any, initialUpdatedAt?: Date }) {
  const router = useRouter()
  
  // Base states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quotationId, setQuotationId] = useState(initialData?.id || "")
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE")
  const [conflictDetected, setConflictDetected] = useState(false)
  const expectedUpdatedAt = useRef<Date | undefined>(initialUpdatedAt)
  
  // Form fields
  const [clients, setClients] = useState(initialClients)
  const [selectedClientId, setSelectedClientId] = useState(initialData?.clientId || "")
  const [prNo, setPrNo] = useState(initialData?.prNo || "")
  const [rfqNo, setRfqNo] = useState(initialData?.rfqNo || "")
  const [items, setItems] = useState<{ 
    product: Product, 
    quantity: number, 
    itemsNo?: string,
    cpSnapshot?: number,
    spSnapshot?: number,
    supplierId?: string,
    comment?: string
  }[]>(initialData?.items?.map((item: any) => ({
    product: item.product,
    quantity: item.quantity,
    itemsNo: item.itemsNo || undefined,
    cpSnapshot: item.cpSnapshot || undefined,
    spSnapshot: item.spSnapshot || 0,
    supplierId: item.supplierId || undefined,
    comment: item.comment || undefined
  })) || [])
  
  // Client Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newClientContact, setNewClientContact] = useState("")
  const [isCreatingClient, setIsCreatingClient] = useState(false)

  // Autocomplete
  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  // Excel Upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Vendor Pricing Dialog
  const [vendorDialogItem, setVendorDialogItem] = useState<{
    productId: string
    productName: string
    currentCp?: number
    currentSp?: number
  } | null>(null)

  // Background Polling for Updates
  useEffect(() => {
    if (!quotationId || conflictDetected) return

    const interval = setInterval(async () => {
      try {
        const res = await getQuotationUpdatedAt(quotationId)
        if (res.success && res.updatedAt && expectedUpdatedAt.current) {
          if (new Date(res.updatedAt).getTime() > new Date(expectedUpdatedAt.current).getTime()) {
            setConflictDetected(true)
          }
        }
      } catch (e) {
        // silently ignore polling errors
      }
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(interval)
  }, [quotationId, conflictDetected])

  // Removed auto-save logic per user request

  // 2. Client Creation
  const handleCreateClient = async () => {
    if (!newClientName.trim()) return
    setIsCreatingClient(true)
    try {
      const res = await createClient({ name: newClientName, contact: newClientContact })
      if (res.success && res.client) {
        setClients(prev => [...prev, res.client].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedClientId(res.client.id)
        setIsClientModalOpen(false)
        setNewClientName("")
        setNewClientContact("")
      } else {
        alert(res.error)
      }
    } catch (e) {
      alert("Failed to create client")
    } finally {
      setIsCreatingClient(false)
    }
  }

  // 3. Autocomplete Logic
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
        addProductToQuotation(filteredProducts[highlightedIndex])
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false)
    }
  }

  const addProductToQuotation = (product: Product, quantity = 1, itemsNo?: string) => {
    setItems(prev => {
      if (prev.find(i => i.product.id === product.id)) return prev
      return [...prev, { 
        product, 
        quantity, 
        itemsNo,
        spSnapshot: 0 // Default to 0, requires manual entry
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

  const handleVendorPriceSave = (cp: number, sp: number, supplierId: string) => {
    if (!vendorDialogItem) return
    setItems(items.map(i => i.product.id === vendorDialogItem.productId ? {
      ...i,
      cpSnapshot: cp,
      spSnapshot: sp,
      supplierId: supplierId
    } : i))
    setVendorDialogItem(null)
  }

  // 4. Excel Upload
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await parseQuotationExcelAction(formData)
      
      if (result.success && result.parsedItems) {
        setItems(prev => {
          const newItems = [...prev]
          result.parsedItems.forEach((parsed: any) => {
            if (!newItems.find(i => i.product.id === parsed.product.id)) {
              newItems.push({
                product: parsed.product,
                quantity: parsed.quantity,
                itemsNo: parsed.itemsNo,
                spSnapshot: 0 // Excel uploads mean SP needs to be filled
              })
            }
          })
          return newItems
        })
        
        const firstItemWithPr = result.parsedItems.find((p: any) => p.prNo)
        if (firstItemWithPr && !prNo) {
          setPrNo(firstItemWithPr.prNo)
        }
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

  // Final Submit
  const handleSubmit = async (status: string) => {
    if (!selectedClientId) return alert("Please select a client")
    if (items.length === 0) return alert("Please add at least one item")

    setIsSubmitting(true)
    setSaveStatus("SAVING")
    try {
      const payload = {
        id: quotationId || undefined,
        clientId: selectedClientId,
        prNo,
        rfqNo,
        status,
        expectedUpdatedAt: expectedUpdatedAt.current,
        items: items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          spSnapshot: item.spSnapshot ?? 0,
          cpSnapshot: item.cpSnapshot,
          supplierId: item.supplierId,
          comment: item.comment
        }))
      }

      const result = await upsertDraftQuotation(payload)
      if (result.error) {
        if (result.error.startsWith("CONFLICT")) {
          setConflictDetected(true)
        }
        throw new Error(result.error)
      }

      if (status === "DRAFT") {
        setSaveStatus("SAVED")
        if (!quotationId) {
          setQuotationId(result.id)
          window.history.replaceState(null, '', `/quotations/${result.id}/edit`)
        }
        
        // Update expectedUpdatedAt to prevent conflict warning from our own save
        if (result.id) {
          const updatedRes = await getQuotationUpdatedAt(result.id)
          if (updatedRes.success && updatedRes.updatedAt) {
            expectedUpdatedAt.current = new Date(updatedRes.updatedAt)
          }
        }
        
        router.refresh()
        setTimeout(() => setSaveStatus("IDLE"), 2000)
      } else {
        router.push(`/quotations/${result.id}`)
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
      {vendorDialogItem && (
        <VendorPriceDialog
          productId={vendorDialogItem.productId}
          productName={vendorDialogItem.productName}
          currentCp={vendorDialogItem.currentCp}
          currentSp={vendorDialogItem.currentSp}
          onSave={handleVendorPriceSave}
          onClose={() => setVendorDialogItem(null)}
        />
      )}

      {/* Conflict Warning Banner */}
      {conflictDetected && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-md flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-rose-500">Conflict Detected: New Updates Available</h3>
            <p className="text-sm text-rose-400 mt-1">
              Someone else has modified this quotation since you opened it. Saving now would overwrite their changes.
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

      {/* Auto-save status */}
      <div className="flex justify-end text-sm h-5">
        {saveStatus === "SAVING" && <span className="text-zinc-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Saving draft...</span>}
        {saveStatus === "SAVED" && <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3"/> Draft saved</span>}
        {saveStatus === "ERROR" && <span className="text-rose-500">Failed to save draft</span>}
      </div>

      {/* Client Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-md border border-premium-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">New Client</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Client Name *</label>
                <input 
                  autoFocus
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Contact (Email/Phone)</label>
                <input 
                  value={newClientContact}
                  onChange={e => setNewClientContact(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
                  placeholder="contact@acme.com"
                />
              </div>
              <button 
                onClick={handleCreateClient}
                disabled={isCreatingClient || !newClientName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-md transition-colors mt-4"
              >
                {isCreatingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-2">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Client *</label>
          <div className="flex gap-2">
            <select 
              value={selectedClientId} 
              onChange={e => setSelectedClientId(e.target.value)}
              className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            >
              <option value="">Select a Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button 
              type="button"
              onClick={() => setIsClientModalOpen(true)}
              className="px-3 bg-white/5 hover:bg-white/10 text-white rounded-md border border-premium-border transition-colors active:scale-95"
              title="Add New Client"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">PR No</label>
          <input 
            value={prNo} 
            onChange={e => setPrNo(e.target.value)}
            type="text" 
            className="w-full bg-zinc-950/50 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">RFQ No</label>
          <input 
            value={rfqNo} 
            onChange={e => setRfqNo(e.target.value)}
            type="text" 
            className="w-full bg-zinc-950/50 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
          />
        </div>
      </div>

      {/* Items Area */}
      <div className="space-y-4 mb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Quotation Items</h2>
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
                    onClick={() => addProductToQuotation(p)}
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
              const sp = item.spSnapshot ?? 0
              const cp = item.cpSnapshot
              const isPending = !cp || !sp
              
              return (
                <div key={item.product.id} className="glass-panel border border-premium-border rounded-lg p-5 group hover:bg-white/[0.03] transition-colors relative">
                  {/* Top Row: Product Info & Remove */}
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
                          placeholder="Add internal comment (optional)..."
                          value={item.comment || ""}
                          onChange={(e) => handleCommentChange(item.product.id, e.target.value)}
                          className="w-full bg-zinc-950/30 border border-transparent hover:border-premium-border focus:border-brand-slate px-2 py-1.5 text-xs text-red-400 focus:text-red-300 rounded focus:outline-none transition-colors placeholder:text-zinc-600"
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

                  {/* Bottom Row: Financials & Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-4 border-t border-premium-border/30">
                    
                    {/* Quantity & UOM */}
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

                    {/* Cost Price */}
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Cost Price</label>
                      <div className="flex flex-col items-start gap-1">
                        <button 
                          onClick={() => setVendorDialogItem({
                            productId: item.product.id,
                            productName: item.product.materialDescription,
                            currentCp: item.cpSnapshot,
                            currentSp: sp
                          })}
                          className={`flex items-center justify-center px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                            cp 
                              ? 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:border-brand-slate hover:text-white' 
                              : 'bg-brand-orange/10 border-brand-orange/50 text-brand-orange hover:bg-brand-orange hover:text-white'
                          }`}
                        >
                          {cp ? `₹${(cp / 100).toFixed(2)}` : 'Set Vendor'}
                        </button>
                        {cp && item.quantity > 0 ? (
                          <span className="text-sm text-amber-500/90 font-mono font-bold pl-1">
                            Σ ₹{((cp * item.quantity) / 100).toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Selling Price */}
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Selling Price</label>
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={() => setVendorDialogItem({
                            productId: item.product.id,
                            productName: item.product.materialDescription,
                            currentCp: item.cpSnapshot,
                            currentSp: sp
                          })}
                          className={`text-sm font-mono font-medium hover:underline ${sp === 0 ? 'text-rose-500' : 'text-white'}`}
                        >
                          {sp > 0 ? `₹${(sp / 100).toFixed(2)}` : 'Set SP'}
                        </button>
                        {sp > 0 && item.quantity > 0 ? (
                          <span className="text-sm text-zinc-300 font-mono font-bold pl-1">
                            Σ ₹{((sp * item.quantity) / 100).toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Profit */}
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2">Est. Profit</label>
                      {sp > 0 && cp ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <span className={`text-lg font-mono font-bold ${sp - cp >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            ₹{(((sp - cp) * item.quantity) / 100).toFixed(2)}
                          </span>
                          <span className={`text-xs font-medium ${sp - cp >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                            {(((sp - cp) / sp) * 100).toFixed(1)}% margin
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 font-mono text-sm">-</span>
                      )}
                    </div>

                    {/* GST */}
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
      {/* Sticky Bottom Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-t border-premium-border/50 p-4 md:px-8 flex flex-col md:flex-row items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-4">
          <div className="flex flex-wrap items-center gap-6 md:gap-12 mb-4 md:mb-0">
            
            {/* Computed Totals */}
            {(() => {
              const totalAmount = items.reduce((sum, item) => sum + Math.round((item.spSnapshot || 0) * item.quantity), 0);
              const totalGst = items.reduce((sum, item) => sum + Math.round(Math.round((item.spSnapshot || 0) * item.quantity) * (item.product.gstRate / 100)), 0);
              const totalPCost = items.reduce((sum, item) => sum + Math.round((item.cpSnapshot || 0) * item.quantity), 0);
              const totalProfit = totalAmount - totalPCost;
              const marginPercent = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
              
              return (
                <>
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Subtotal</div>
                    <div className="text-lg font-bold text-white">₹{(totalAmount / 100).toFixed(2)}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total P. Cost</div>
                    <div className="text-lg font-bold text-amber-500/90">₹{(totalPCost / 100).toFixed(2)}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Est. Profit</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-emerald-500">₹{(totalProfit / 100).toFixed(2)}</span>
                      {totalProfit > 0 && <span className="text-xs text-emerald-500/70 font-medium">({marginPercent.toFixed(1)}%)</span>}
                    </div>
                  </div>
                  
                  <div className="hidden lg:block w-px h-10 bg-premium-border/50"></div>
                  
                  <div className="space-y-1">
                    <div className="text-[10px] text-brand-orange/80 uppercase font-bold tracking-widest">Grand Total (inc. GST)</div>
                    <div className="text-2xl font-black text-brand-orange">₹{((totalAmount + totalGst) / 100).toFixed(2)}</div>
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
              onClick={() => handleSubmit("PENDING")}
              disabled={isSubmitting}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {quotationId ? "Update Quotation" : "Create Quotation"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

