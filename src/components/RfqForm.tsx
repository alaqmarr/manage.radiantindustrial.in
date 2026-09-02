"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createQuickProduct } from "@/app/actions/product"
import { upsertDraftRfq, getRfqUpdatedAt } from "@/app/actions/rfq"
import { createSupplier } from "@/app/actions/supplier"
import { parseQuotationExcelAction } from "@/app/actions/import"
import { getQuotationsForImport } from "@/app/actions/quotation"
import { formatRupee, numberToWordsRupees } from "@/lib/utils"
import { Loader2, Plus, Trash2, Upload, X, Check, AlertCircle, Search, Download } from "lucide-react"
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
    comment?: string
  }[]>(initialData?.items?.map((item: any) => ({
    product: item.product,
    quantity: item.quantity,
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
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdDesc, setNewProdDesc] = useState("")
  const [newProdUnit, setNewProdUnit] = useState("NUM")
  const [newProdGst, setNewProdGst] = useState("18")
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [isImportQuotModalOpen, setIsImportQuotModalOpen] = useState(false)
  const [importQuotations, setImportQuotations] = useState<any[]>([])
  const [selectedQuotId, setSelectedQuotId] = useState("")
  const [loadingQuotations, setLoadingQuotations] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [importItemSearch, setImportItemSearch] = useState("")

  const handleOpenImportQuot = async () => {
    setIsImportQuotModalOpen(true)
    setLoadingQuotations(true)
    setSelectedQuotId("")
    setSelectedItemIds(new Set())
    setImportItemSearch("")
    try {
      const res = await getQuotationsForImport()
      if (res.success && res.quotations) {
        setImportQuotations(res.quotations)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingQuotations(false)
    }
  }

  const handleImportSelectedItems = () => {
    const quot = importQuotations.find(q => q.id === selectedQuotId)
    if (!quot) return
    const itemsToAdd = quot.items.filter((i: any) => selectedItemIds.has(i.id))
    
    setItems(prev => {
      const newItems = [...prev]
      itemsToAdd.forEach((i: any) => {
        if (!newItems.find(exist => exist.product.id === i.product.id)) {
          newItems.push({
            product: i.product,
            quantity: i.quantity,
            comment: i.comment || undefined
          })
        }
      })
      return newItems
    })
    setIsImportQuotModalOpen(false)
  }

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
        addProductToRfq(res.product)
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
      item
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

      {isImportQuotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 w-full max-w-4xl p-6 rounded-md border border-premium-border flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h3 className="text-xl font-medium text-white">Import from Quotation</h3>
              <button onClick={() => setIsImportQuotModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {loadingQuotations ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                  <div className="w-full md:w-1/3 flex flex-col min-h-0 border-r border-premium-border pr-6">
                    <h4 className="text-sm font-bold text-zinc-400 mb-3 shrink-0">Select Quotation</h4>
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                      {importQuotations.map(q => (
                        <div 
                          key={q.id} 
                          onClick={() => { setSelectedQuotId(q.id); setSelectedItemIds(new Set(q.items.map((i:any)=>i.id))) }}
                          className={`p-3 rounded-md cursor-pointer border transition-colors ${selectedQuotId === q.id ? 'bg-brand-slate/20 border-brand-slate text-white' : 'bg-zinc-950 border-premium-border hover:bg-white/5 text-zinc-300'}`}
                        >
                          <div className="font-mono text-xs mb-1">{q.id.slice(-6).toUpperCase()}</div>
                          <div className="font-medium truncate">{q.client.name}</div>
                          {q.prNo && <div className="text-xs text-zinc-500 mt-1">PR: {q.prNo}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full md:w-2/3 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <h4 className="text-sm font-bold text-zinc-400">Select Items to Import</h4>
                      {selectedQuotId && (
                        <div className="relative">
                          <Search className="w-4 h-4 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search items..."
                            value={importItemSearch}
                            onChange={(e) => setImportItemSearch(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-slate"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {!selectedQuotId ? (
                        <div className="h-full flex items-center justify-center text-zinc-500">
                          Select a quotation to view items
                        </div>
                      ) : (
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-zinc-400 sticky top-0 bg-zinc-900 border-b border-premium-border z-10">
                            <tr>
                              <th className="py-2 px-3">
                                <input 
                                  type="checkbox" 
                                  checked={(() => {
                                    const filtered = importQuotations.find(q=>q.id===selectedQuotId)?.items.filter((i: any) => {
                                      if (!importItemSearch) return true
                                      const term = importItemSearch.toLowerCase()
                                      return i.product.materialCode?.toLowerCase().includes(term) ||
                                             i.product.materialDescription?.toLowerCase().includes(term) ||
                                             i.product.specification?.toLowerCase().includes(term) ||
                                             i.comment?.toLowerCase().includes(term)
                                    }) || []
                                    const available = filtered.filter((i:any) => !items.some(exist => exist.product.id === i.product.id))
                                    return available.length > 0 && available.every((i:any) => selectedItemIds.has(i.id))
                                  })()}
                                  onChange={(e) => {
                                    const filtered = importQuotations.find(q=>q.id===selectedQuotId)?.items.filter((i: any) => {
                                      if (!importItemSearch) return true
                                      const term = importItemSearch.toLowerCase()
                                      return i.product.materialCode?.toLowerCase().includes(term) ||
                                             i.product.materialDescription?.toLowerCase().includes(term) ||
                                             i.product.specification?.toLowerCase().includes(term) ||
                                             i.comment?.toLowerCase().includes(term)
                                    }) || []
                                    const available = filtered.filter((i:any) => !items.some(exist => exist.product.id === i.product.id))
                                    const newSet = new Set(selectedItemIds)
                                    if (e.target.checked) {
                                      available.forEach((i:any) => newSet.add(i.id))
                                    } else {
                                      available.forEach((i:any) => newSet.delete(i.id))
                                    }
                                    setSelectedItemIds(newSet)
                                  }}
                                  className="rounded border-zinc-700 text-brand-slate focus:ring-brand-slate bg-zinc-950"
                                />
                              </th>
                              <th className="py-2 px-3">Code</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3 text-center">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-premium-border">
                            {importQuotations.find(q=>q.id===selectedQuotId)?.items
                              .filter((i: any) => {
                                if (!importItemSearch) return true
                                const term = importItemSearch.toLowerCase()
                                return i.product.materialCode?.toLowerCase().includes(term) ||
                                       i.product.materialDescription?.toLowerCase().includes(term) ||
                                       i.product.specification?.toLowerCase().includes(term) ||
                                       i.comment?.toLowerCase().includes(term)
                              })
                              .map((item: any) => {
                                const isAdded = items.some(exist => exist.product.id === item.product.id)
                                return (
                                  <tr key={item.id} className={`hover:bg-white/5 ${isAdded ? 'opacity-50 bg-white/5' : ''}`}>
                                    <td className="py-3 px-3 align-top">
                                      <input 
                                        type="checkbox" 
                                        checked={selectedItemIds.has(item.id) || isAdded}
                                        disabled={isAdded}
                                        onChange={(e) => {
                                          const newSet = new Set(selectedItemIds)
                                          if (e.target.checked) newSet.add(item.id)
                                          else newSet.delete(item.id)
                                          setSelectedItemIds(newSet)
                                        }}
                                        className="rounded border-zinc-700 text-brand-slate focus:ring-brand-slate bg-zinc-950 disabled:opacity-50 mt-1"
                                      />
                                    </td>
                                    <td className="py-3 px-3 font-mono text-xs align-top pt-4">{item.product.materialCode}</td>
                                    <td className="py-3 px-3 align-top">
                                      <div className="font-medium text-zinc-200">{item.product.materialDescription}</div>
                                      {item.product.specification && <div className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{item.product.specification}</div>}
                                      {item.comment && <div className="text-xs text-brand-orange mt-1 italic whitespace-pre-wrap">Note: {item.comment}</div>}
                                      {isAdded && <div className="text-[10px] font-bold text-emerald-500 mt-2">ALREADY ADDED</div>}
                                    </td>
                                    <td className="py-3 px-3 text-center align-top pt-4">{item.quantity}</td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-premium-border shrink-0">
              <button 
                onClick={() => setIsImportQuotModalOpen(false)}
                className="px-4 py-2 text-zinc-300 hover:text-white transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleImportSelectedItems}
                disabled={selectedItemIds.size === 0}
                className="px-4 py-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-md transition-colors"
              >
                Import {selectedItemIds.size > 0 ? `(${selectedItemIds.size})` : ''} Items
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenImportQuot}
              className="flex items-center gap-2 px-4 py-2 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 font-medium rounded-md transition-colors text-sm border border-brand-orange/20 active:scale-95"
            >
              <Download className="w-4 h-4" />
              Import from Quotation
            </button>

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
        
        <div className="relative z-[55]" ref={autocompleteRef}>
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
            <ul className="absolute z-[60] mt-2 w-full glass-panel border border-premium-border rounded-md shadow-2xl max-h-60 overflow-y-auto custom-scrollbar overflow-x-hidden animate-in fade-in slide-in-from-top-2">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-premium-border/30">
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

                    

                    

                    
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-t border-premium-border/50 p-4 md:px-8 flex flex-col md:flex-row items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-4">
          <div className="flex flex-wrap items-center gap-6 md:gap-12 mb-4 md:mb-0"></div>
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
