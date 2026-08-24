"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createCoc, updateCoc } from "@/app/actions/coc"
import { createQuickProduct } from "@/app/actions/product"
import { Loader2, Plus, Trash2, X, Check, Search } from "lucide-react"

type Client = { id: string, name: string }
type Product = { id: string, materialCode: string, materialDescription: string, unit: string, specification?: string | null }

export function CocForm({ clients, products, initialData, defaultCocMessage }: { clients: Client[], products: Product[], initialData?: any, defaultCocMessage: string }) {
  const router = useRouter()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE")
  
  const [selectedClientId, setSelectedClientId] = useState(initialData?.clientId || "")
  const [date, setDate] = useState(initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
  const [cocNumber, setCocNumber] = useState(initialData?.cocNumber || "")
  const [quotationId, setQuotationId] = useState(initialData?.quotationId || "")
  const [clientPoRef, setClientPoRef] = useState(initialData?.clientPoRef || "")
  const [remarks, setRemarks] = useState(initialData?.remarks || "")
  const [standardText, setStandardText] = useState(initialData?.standardText || defaultCocMessage)

  const [items, setItems] = useState<{ 
    product: Product, 
    quantity: number,
    batchNo: string,
    remarks?: string
  }[]>(initialData?.items?.map((item: any) => ({
    product: item.product,
    quantity: item.quantity,
    batchNo: item.batchNo || "",
    remarks: item.remarks || ""
  })) || [])
  
  const [searchTerm, setSearchTerm] = useState("")
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdDesc, setNewProdDesc] = useState("")
  const [newProdUnit, setNewProdUnit] = useState("NUM")
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  const handleCreateProduct = async () => {
    if (!newProdCode.trim() || !newProdDesc.trim()) return
    setIsCreatingProduct(true)
    try {
      const res = await createQuickProduct({
        materialCode: newProdCode,
        materialDescription: newProdDesc,
        unit: newProdUnit,
        gstRate: 18,
      })
      if (res.success && res.product) {
        products.push(res.product as any)
        addItem(res.product as any)
        setIsProductModalOpen(false)
        setNewProdCode("")
        setNewProdDesc("")
      } else {
        alert(res.error || "Failed to create product")
      }
    } catch (e) {
      alert("Failed to create product")
    } finally {
      setIsCreatingProduct(false)
    }
  }

  const filteredProducts = searchTerm ? products.filter(p => 
    p.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10) : []

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
    if (!isDropdownOpen || filteredProducts.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      addItem(filteredProducts[highlightedIndex])
    }
  }

  const addItem = (product: Product) => {
    setItems(prev => [...prev, { product, quantity: 1, batchNo: "", remarks: "" }])
    setSearchTerm("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const handleSave = async () => {
    if (!selectedClientId) {
      alert("Please select a client")
      return
    }
    if (items.length === 0) {
      alert("Please add at least one item")
      return
    }

    setIsSubmitting(true)
    setSaveStatus("SAVING")

    const data = {
      clientId: selectedClientId,
      cocNumber,
      date,
      quotationId,
      clientPoRef,
      remarks,
      standardText,
      items: items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        batchNo: item.batchNo,
        remarks: item.remarks
      }))
    }

    try {
      let res;
      if (initialData?.id) {
        res = await updateCoc(initialData.id, data)
      } else {
        res = await createCoc(data)
      }

      if (res.success) {
        setSaveStatus("SAVED")
        if (!initialData?.id) {
          router.push(`/cocs/${(res as any).id}`)
        } else {
          setTimeout(() => setSaveStatus("IDLE"), 2000)
        }
      } else {
        setSaveStatus("ERROR")
        alert(res.error || "Failed to save COC")
      }
    } catch (e) {
      setSaveStatus("ERROR")
      alert("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Certificate Details</h2>
          <p className="text-zinc-400 text-sm">Select client and COC metadata.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-md transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saveStatus === "SAVING" ? "Saving..." : saveStatus === "SAVED" ? "Saved!" : "Save Certificate"}
        </button>
      </div>

      <div className="glass-panel p-6 rounded-lg border border-premium-border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Client *</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate appearance-none"
            >
              <option value="">Select a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">COC Number (Auto if blank)</label>
            <input
              type="text"
              value={cocNumber}
              onChange={(e) => setCocNumber(e.target.value)}
              placeholder="e.g. COC-2026-001"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Client PO Reference (Optional)</label>
            <input
              type="text"
              value={clientPoRef}
              onChange={(e) => setClientPoRef(e.target.value)}
              placeholder="e.g. PO-45920"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Internal Quotation ID (Optional)</label>
            <input
              type="text"
              value={quotationId}
              onChange={(e) => setQuotationId(e.target.value)}
              placeholder="Paste ID if applicable"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            />
          </div>
        </div>
        
        <div className="pt-4 border-t border-zinc-800">
            <label className="block text-sm font-medium text-zinc-400 mb-2">Standard Certification Text</label>
            <textarea
              value={standardText}
              onChange={(e) => setStandardText(e.target.value)}
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
            />
            <p className="text-xs text-zinc-500 mt-1">This text appears at the top of the certificate body.</p>
        </div>
      </div>

      <div className="pt-8">
        <h2 className="text-xl font-bold text-white mb-2">Certified Items</h2>
        <p className="text-zinc-400 text-sm mb-6">Add the products and batch/lot numbers covered by this certificate.</p>
        
        <div className="relative mb-6" ref={autocompleteRef}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-500" />
          </div>
          <input
            type="text"
            placeholder="Search products by code or description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsDropdownOpen(true)
              setHighlightedIndex(-1)
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate text-lg shadow-inner"
          />
          
          {isDropdownOpen && searchTerm && (
            <div className="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl max-h-80 overflow-y-auto overflow-x-hidden">
              {filteredProducts.length > 0 ? (
                <ul className="py-2">
                  {filteredProducts.map((product, index) => (
                    <li 
                      key={product.id}
                      onClick={() => addItem(product)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between group ${highlightedIndex === index ? 'bg-brand-slate/20' : 'hover:bg-zinc-800'}`}
                    >
                      <div>
                        <div className="font-mono text-sm text-brand-slate group-hover:text-brand-slate-light">{product.materialCode}</div>
                        <div className="text-white text-sm line-clamp-1">{product.materialDescription}</div>
                      </div>
                      <Plus className="w-4 h-4 text-zinc-500 group-hover:text-white" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-zinc-400 mb-4">No products found matching "{searchTerm}"</p>
                  <button
                    onClick={() => {
                      setNewProdCode(searchTerm.toUpperCase())
                      setNewProdDesc("")
                      setIsProductModalOpen(true)
                      setIsDropdownOpen(false)
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-md transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Create New Product
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="glass-panel rounded-lg border border-premium-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-white/5 text-zinc-400 border-b border-premium-border">
                  <tr>
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4 min-w-[200px]">Product Details</th>
                    <th className="py-3 px-4 w-32">Qty</th>
                    <th className="py-3 px-4 w-48">Batch / Lot No</th>
                    <th className="py-3 px-4">Remarks (Optional)</th>
                    <th className="py-3 px-4 w-16 text-center">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-premium-border">
                  {items.map((item, index) => (
                    <tr key={index} className="bg-transparent hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-zinc-500 font-mono">{index + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-brand-slate text-xs mb-1">{item.product.materialCode}</div>
                        <div className="text-white font-medium line-clamp-2" title={item.product.materialDescription}>{item.product.materialDescription}</div>
                        {item.product.specification && (
                          <div className="text-zinc-500 text-xs mt-1 line-clamp-1">{item.product.specification}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="0.1"
                            step="0.1"
                            value={item.quantity || ""} 
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-white focus:outline-none focus:border-brand-slate"
                          />
                          <span className="text-xs text-zinc-500">{item.product.unit}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input 
                          type="text" 
                          value={item.batchNo} 
                          onChange={(e) => updateItem(index, 'batchNo', e.target.value)}
                          placeholder="Batch/Lot"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-white focus:outline-none focus:border-brand-slate"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input 
                          type="text" 
                          value={item.remarks} 
                          onChange={(e) => updateItem(index, 'remarks', e.target.value)}
                          placeholder="e.g. Verified OK"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-white focus:outline-none focus:border-brand-slate"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => removeItem(index)} className="p-1.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors" title="Remove item">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Product Creation Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-premium-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-premium-border bg-white/5">
              <h3 className="font-bold text-white">Quick Create Product</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Material Code</label>
                <input type="text" value={newProdCode} onChange={(e) => setNewProdCode(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea value={newProdDesc} onChange={(e) => setNewProdDesc(e.target.value)} rows={3} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Unit of Measure</label>
                <select value={newProdUnit} onChange={(e) => setNewProdUnit(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-white focus:outline-none">
                  <option value="NUM">Numbers (NUM)</option>
                  <option value="KG">Kilograms (KG)</option>
                  <option value="MTR">Meters (MTR)</option>
                  <option value="SET">Sets (SET)</option>
                  <option value="LTR">Liters (LTR)</option>
                  <option value="BOX">Boxes (BOX)</option>
                  <option value="PKT">Packets (PKT)</option>
                </select>
              </div>
              <button 
                onClick={handleCreateProduct}
                disabled={isCreatingProduct || !newProdCode || !newProdDesc}
                className="w-full py-2 bg-brand-slate hover:bg-slate-500 text-white rounded-md font-medium disabled:opacity-50 transition-colors"
              >
                {isCreatingProduct ? 'Creating...' : 'Save Product & Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
