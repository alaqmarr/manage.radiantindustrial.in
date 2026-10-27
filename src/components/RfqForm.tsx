"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createQuickProduct } from "@/app/actions/product"
import { upsertDraftRfq, getRfqUpdatedAt } from "@/app/actions/rfq"
import { createSupplier } from "@/app/actions/supplier"
import { parseQuotationExcelAction } from "@/app/actions/import"
import { getQuotationsForImport } from "@/app/actions/quotation"
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  Check,
  AlertCircle,
  Search,
  Download,
  Globe,
  Building2,
} from "lucide-react"
import { verifyGSTAction } from "@/app/actions/gst"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { sileo } from "sileo"

type Supplier = { id: string; name: string }
type Product = {
  id: string
  materialCode: string
  materialDescription: string
  sellingPrice: number
  costPrice: number
  gstRate: number
  unit: string
  specification?: string | null
}

export function RfqForm({
  suppliers: initialSuppliers,
  products,
  initialData,
  initialUpdatedAt,
}: {
  suppliers: Supplier[]
  products: Product[]
  initialData?: any
  initialUpdatedAt?: Date
}) {
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rfqId, setRfqId] = useState(initialData?.id || "")
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE")
  const [conflictDetected, setConflictDetected] = useState(false)
  const expectedUpdatedAt = useRef<Date | undefined>(initialUpdatedAt)

  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialData?.supplierId || "")
  const [isPublic, setIsPublic] = useState(initialData?.isPublic || false)
  const [items, setItems] = useState<
    {
      product: Product
      quantity: number
      comment?: string
    }[]
  >(
    initialData?.items?.map((item: any) => ({
      product: item.product,
      quantity: item.quantity,
      comment: item.comment || undefined,
    })) || []
  )

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

  const [newSupplierGst, setNewSupplierGst] = useState("")
  const [newSupplierLocation, setNewSupplierLocation] = useState("")

  const [isVerifyingGST, setIsVerifyingGST] = useState(false)
  const handleVerifyGST = async () => {
    if (!newSupplierGst.trim() || newSupplierGst.length < 15) {
      sileo.warning({
        title: "Invalid GSTIN",
        description: "Please enter a valid 15-character GST Number.",
      })
      return
    }
    setIsVerifyingGST(true)
    try {
      const res = await verifyGSTAction(newSupplierGst.trim())
      if (res.error) {
        sileo.error({ title: "GST Verification Failed", description: res.error })
      } else if (res.data) {
        setNewSupplierName(res.data.name || newSupplierName)
        setNewSupplierLocation(res.data.location || res.data.address || newSupplierLocation)
        sileo.success({
          title: "GST Details Fetched",
          description: res.data.legalName
            ? `${res.data.name} (${res.data.legalName})`
            : res.data.name,
        })
      }
    } catch (e) {
      sileo.error({ title: "Verification Error", description: "Failed to verify GSTIN." })
    } finally {
      setIsVerifyingGST(false)
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
    const quot = importQuotations.find((q) => q.id === selectedQuotId)
    if (!quot) return
    const itemsToAdd = quot.items.filter((i: any) => selectedItemIds.has(i.id))

    setItems((prev) => {
      const newItems = [...prev]
      itemsToAdd.forEach((i: any) => {
        newItems.push({
          product: { ...i.product },
          quantity: i.quantity,
          comment: i.comment || undefined,
        })
      })
      return newItems
    })
    sileo.success({
      title: "Items Imported",
      description: `Imported ${itemsToAdd.length} item(s) from quotation.`,
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
      } catch (e) {}
    }, 10000)

    return () => clearInterval(interval)
  }, [rfqId, conflictDetected])

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return
    setIsCreatingSupplier(true)
    try {
      const res = await createSupplier({
        name: newSupplierName,
        contact: newSupplierContact,
        gstNumber: newSupplierGst,
        location: newSupplierLocation,
      })
      if (res.success && res.supplier) {
        setSuppliers((prev) =>
          [...prev, res.supplier].sort((a, b) => a.name.localeCompare(b.name))
        )
        setSelectedSupplierId(res.supplier.id)
        setIsSupplierModalOpen(false)
        setNewSupplierName("")
        setNewSupplierContact("")
        setNewSupplierGst("")
        setNewSupplierLocation("")
        sileo.success({
          title: "Supplier Created",
          description: `${res.supplier.name} added and selected.`,
        })
      } else {
        sileo.error({
          title: "Supplier Creation Failed",
          description: res.error || "Could not create supplier.",
        })
      }
    } catch (e) {
      sileo.error({ title: "Error", description: "Failed to create supplier." })
    } finally {
      setIsCreatingSupplier(false)
    }
  }

  const filteredProducts = products
    .filter(
      (p) =>
        p.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 50)

  const handleCreateProduct = async () => {
    if (!newProdDesc.trim()) {
      sileo.warning({
        title: "Description Required",
        description: "Please enter a product description.",
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
      })
      if (res.success && res.product) {
        setIsProductModalOpen(false)
        addProductToRfq(res.product)
        setNewProdCode("")
        setNewProdDesc("")
        setNewProdUnit("NUM")
        setNewProdGst("18")
        sileo.success({
          title: "Product Created",
          description: `${res.product.materialCode} added to RFQ.`,
        })
      } else {
        sileo.error({
          title: "Product Creation Failed",
          description: res.error || "Could not create product.",
        })
      }
    } catch (e) {
      sileo.error({ title: "Error", description: "Failed to create product." })
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
      setHighlightedIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
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
    setItems((prev) => [
      ...prev,
      {
        product: { ...product },
        quantity,
      },
    ])
    setSearchTerm("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleQuantityChange = (idx: number, quantity: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, quantity } : item))
    )
  }

  const handleCommentChange = (idx: number, comment: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, comment } : item))
    )
  }

  const handleProductChange = (
    idx: number,
    field: "materialCode" | "materialDescription" | "unit" | "gstRate",
    value: any
  ) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              product: { ...item.product, [field]: value },
            }
          : item
      )
    )
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await parseQuotationExcelAction(formData)

      if (result.success && result.parsedItems) {
        setItems((prev) => {
          const newItems = [...prev]
          result.parsedItems.forEach((parsed: any) => {
            newItems.push({
              product: { ...parsed.product },
              quantity: parsed.quantity,
            })
          })
          return newItems
        })
        sileo.success({
          title: "Excel Imported",
          description: `Added ${result.parsedItems.length} items to RFQ.`,
        })
      } else {
        sileo.error({
          title: "Excel Import Failed",
          description: result.error || "Failed to parse Excel",
        })
      }
    } catch (e: any) {
      sileo.error({ title: "Upload Error", description: "Error uploading Excel file." })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (status: string) => {
    if (!isPublic && !selectedSupplierId) {
      sileo.warning({
        title: "Supplier Required",
        description: "Please select a supplier or make this a Public RFQ.",
      })
      return
    }
    if (items.length === 0) {
      sileo.warning({
        title: "Empty RFQ",
        description: "Please add at least one item.",
      })
      return
    }

    setIsSubmitting(true)
    setSaveStatus("SAVING")
    try {
      const payload = {
        id: rfqId || undefined,
        supplierId: selectedSupplierId,
        isPublic,
        status,
        expectedUpdatedAt: expectedUpdatedAt.current,
        items: items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          comment: item.comment,
        })),
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
        sileo.success({
          title: "Draft Saved",
          description: `RFQ ${result.id} saved as draft.`,
        })
        if (!rfqId) {
          setRfqId(result.id)
          window.history.replaceState(null, "", `/rfq/${result.id}/edit`)
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
        sileo.success({
          title: "RFQ Issued",
          description: `RFQ ${result.id} saved and ready.`,
        })
        router.push(`/rfq/${result.id}`)
        router.refresh()
      }
    } catch (error: any) {
      console.error(error)
      sileo.error({
        title: "Save Failed",
        description: error.message || "Something went wrong",
      })
      setSaveStatus("ERROR")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-28">
      {conflictDetected && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-rose-900">
              Conflict Detected: New Updates Available
            </h3>
            <p className="text-xs text-rose-700 mt-1">
              Someone else has modified this RFQ since you opened it. Saving now would overwrite their changes.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <span className="text-white">Reload to see latest changes</span>
            </button>
          </div>
        </div>
      )}

      {/* Supplier / Public RFQ Mode Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              1. Vendor Assignment Mode
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose whether to send this RFQ to a specific vendor or generate a Public Bidding Link for multiple suppliers.
            </p>
          </div>
          <div className="text-xs font-medium">
            {saveStatus === "SAVING" && (
              <span className="text-slate-500 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving draft...
              </span>
            )}
            {saveStatus === "SAVED" && (
              <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                <Check className="w-3.5 h-3.5" /> Draft saved
              </span>
            )}
            {saveStatus === "ERROR" && <span className="text-rose-600">Failed to save draft</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label
            className={`flex items-start gap-3.5 cursor-pointer p-4 rounded-xl border transition-all ${
              isPublic
                ? "border-violet-300 bg-violet-50/60 ring-2 ring-violet-500/10"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => {
                setIsPublic(e.target.checked)
                if (e.target.checked) setSelectedSupplierId("")
              }}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 accent-violet-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <Globe className="w-4 h-4 text-violet-600" />
                Public RFQ (Multiple Vendors Bidding Link)
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Generate a shareable web portal link where any invited vendor can enter their rates online.
              </p>
            </div>
          </label>

          {!isPublic ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Supplier <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                >
                  <option value="">-- Select a Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(true)}
                  className="px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors active:scale-95 flex items-center gap-1 text-xs font-semibold"
                  title="Add New Supplier"
                >
                  <Plus className="w-4 h-4" /> New
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-violet-50/40 border border-dashed border-violet-200 flex items-center gap-3 text-xs text-violet-800">
              <Building2 className="w-5 h-5 text-violet-600 shrink-0" />
              <span>
                Once you issue this Public RFQ, you will get a <strong>Public Bidding Link</strong> on the next screen that you can WhatsApp or email to multiple suppliers.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Items Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              2. Inquiry Line Items ({items.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Search products below, import items from a Client Quotation, or upload an Excel sheet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenImportQuot}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 font-semibold rounded-xl transition-colors text-xs border border-orange-200 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
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
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-semibold rounded-xl transition-colors text-xs border border-slate-200 active:scale-95"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-slate-500" />
              )}
              Upload Excel
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative z-20" ref={autocompleteRef}>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setIsDropdownOpen(true)
                setHighlightedIndex(-1)
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search products by material code or description to add to RFQ..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>

          {isDropdownOpen && searchTerm && (
            <ul className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <li className="p-4 text-center">
                  <p className="text-slate-500 text-xs mb-2">
                    No matching products found for &ldquo;{searchTerm}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewProdDesc(searchTerm)
                      setIsProductModalOpen(true)
                      setIsDropdownOpen(false)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">Quick Create Product</span>
                  </button>
                </li>
              ) : (
                filteredProducts.map((p, idx) => (
                  <li
                    key={p.id}
                    onClick={() => addProductToRfq(p)}
                    className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                      highlightedIndex === idx ? "bg-violet-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-mono font-bold text-violet-700">
                        {p.materialCode}
                      </div>
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {p.materialDescription}
                      </div>
                      {p.specification && (
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {p.specification}
                        </div>
                      )}
                    </div>
                    <Plus className="w-4 h-4 text-violet-600 shrink-0" />
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {/* High-Density Items Table */}
        {items.length > 0 ? (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4 w-36">Material Code</th>
                    <th className="py-3 px-4 min-w-[240px]">Description & Spec</th>
                    <th className="py-3 px-4 w-40">Required Qty / UOM</th>
                    <th className="py-3 px-4">Vendor Note / Comment</th>
                    <th className="py-3 px-4 w-14 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => (
                    <tr key={`${item.product.id}-${idx}`} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.product.materialCode}
                          onChange={(e) =>
                            handleProductChange(idx, "materialCode", e.target.value)
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-violet-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.product.materialDescription}
                          onChange={(e) =>
                            handleProductChange(
                              idx,
                              "materialDescription",
                              e.target.value
                            )
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-violet-500"
                        />
                        {item.product.specification && (
                          <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                            {item.product.specification}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <SmartNumberInput
                            value={item.quantity}
                            maxDecimals={3}
                            onValueChange={(num) =>
                              handleQuantityChange(idx, num)
                            }
                            className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-violet-500"
                          />
                          <input
                            type="text"
                            value={item.product.unit}
                            onChange={(e) =>
                              handleProductChange(idx, "unit", e.target.value)
                            }
                            className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1.5 font-mono text-xs text-slate-600 text-center uppercase focus:bg-white focus:outline-none"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Optional note for vendor..."
                          value={item.comment || ""}
                          onChange={(e) => handleCommentChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-violet-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remove Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
            <p className="text-sm font-semibold text-slate-700">No items in this RFQ yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Search products above, click &ldquo;Import from Quotation&rdquo;, or upload an Excel file.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="text-xs text-slate-600 font-medium">
            Total Inquiry Items: <strong className="text-slate-900">{items.length}</strong> • Mode:{" "}
            <strong className="text-violet-700">
              {isPublic ? "Public Multi-Vendor Link" : "Direct Supplier RFQ"}
            </strong>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => handleSubmit("DRAFT")}
              disabled={isSubmitting || saveStatus === "SAVING"}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl transition-colors border border-slate-200 disabled:opacity-50"
            >
              {saveStatus === "SAVING" ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => handleSubmit("ISSUED")}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-7 py-2.5 bg-orange-600 hover:bg-orange-700 shadow-sm text-white font-semibold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Check className="w-4 h-4 text-white" />
              )}
              <span className="text-white">{rfqId ? "Update RFQ" : "Issue RFQ"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-2xl border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">Quick Create Product</h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Material Code (Optional)
                </label>
                <input
                  value={newProdCode}
                  onChange={(e) => setNewProdCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-violet-500"
                  placeholder="Auto-generated if left blank"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Description *
                </label>
                <input
                  autoFocus
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Unit
                  </label>
                  <input
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    GST %
                  </label>
                  <input
                    type="number"
                    value={newProdGst}
                    onChange={(e) => setNewProdGst(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateProduct}
                disabled={isCreatingProduct || !newProdDesc.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors mt-2"
              >
                {isCreatingProduct ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <span className="text-white">Create & Add Product</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-2xl border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">Add New Supplier</h3>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  GST Number
                </label>
                <div className="flex gap-2">
                  <input
                    value={newSupplierGst}
                    onChange={(e) => setNewSupplierGst(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-mono text-slate-900 uppercase focus:bg-white focus:outline-none"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyGST}
                    disabled={isVerifyingGST}
                    className="flex items-center gap-1 px-3 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {isVerifyingGST ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="text-xs font-semibold">Verify</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Supplier Name *
                </label>
                <input
                  autoFocus
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none"
                  placeholder="Acme Vendor Corp"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Location / Address
                </label>
                <input
                  value={newSupplierLocation}
                  onChange={(e) => setNewSupplierLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none"
                  placeholder="City, State"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Contact (Email / Phone)
                </label>
                <input
                  value={newSupplierContact}
                  onChange={(e) => setNewSupplierContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none"
                  placeholder="vendor@acme.com"
                />
              </div>
              <button
                onClick={handleCreateSupplier}
                disabled={isCreatingSupplier || !newSupplierName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors mt-2"
              >
                {isCreatingSupplier ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <span className="text-white">Create Supplier</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import from Quotation Modal */}
      {isImportQuotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-4xl p-6 rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[82vh]">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Import Items from Quotation</h3>
                <p className="text-xs text-slate-500">
                  Select a Client Quotation on the left to pick items for this vendor RFQ.
                </p>
              </div>
              <button
                onClick={() => setIsImportQuotModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {loadingQuotations ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-5 h-full min-h-0">
                  <div className="w-full md:w-1/3 flex flex-col min-h-0 border-r border-slate-200 pr-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 shrink-0">
                      1. Select Quotation
                    </h4>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {importQuotations.map((q) => (
                        <div
                          key={q.id}
                          onClick={() => {
                            setSelectedQuotId(q.id)
                            setSelectedItemIds(new Set(q.items.map((i: any) => i.id)))
                          }}
                          className={`p-3 rounded-xl cursor-pointer border transition-colors ${
                            selectedQuotId === q.id
                              ? "bg-orange-50 border-orange-300 text-slate-900"
                              : "bg-slate-50/60 border-slate-200 hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          <div className="font-mono text-xs font-bold text-orange-600 mb-0.5">
                            #{q.id.slice(-6).toUpperCase()}
                          </div>
                          <div className="font-semibold text-sm truncate">{q.client.name}</div>
                          {q.prNo && (
                            <div className="text-xs text-slate-500 mt-0.5">PR: {q.prNo}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full md:w-2/3 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2.5 shrink-0">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        2. Select Items to Import
                      </h4>
                      {selectedQuotId && (
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter items..."
                            value={importItemSearch}
                            onChange={(e) => setImportItemSearch(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-900 focus:bg-white focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
                      {!selectedQuotId ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm p-8">
                          Select a quotation on the left to view its line items
                        </div>
                      ) : (
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr>
                              <th className="py-2.5 px-3 w-10">
                                <input
                                  type="checkbox"
                                  checked={(() => {
                                    const filtered =
                                      importQuotations
                                        .find((q) => q.id === selectedQuotId)
                                        ?.items.filter((i: any) => {
                                          if (!importItemSearch) return true
                                          const term = importItemSearch.toLowerCase()
                                          return (
                                            i.product.materialCode?.toLowerCase().includes(term) ||
                                            i.product.materialDescription
                                              ?.toLowerCase()
                                              .includes(term)
                                          )
                                        }) || []
                                    const available = filtered.filter(
                                      (i: any) =>
                                        !items.some((exist) => exist.product.id === i.product.id)
                                    )
                                    return (
                                      available.length > 0 &&
                                      available.every((i: any) => selectedItemIds.has(i.id))
                                    )
                                  })()}
                                  onChange={(e) => {
                                    const filtered =
                                      importQuotations
                                        .find((q) => q.id === selectedQuotId)
                                        ?.items.filter((i: any) => {
                                          if (!importItemSearch) return true
                                          const term = importItemSearch.toLowerCase()
                                          return (
                                            i.product.materialCode?.toLowerCase().includes(term) ||
                                            i.product.materialDescription
                                              ?.toLowerCase()
                                              .includes(term)
                                          )
                                        }) || []
                                    const available = filtered.filter(
                                      (i: any) =>
                                        !items.some((exist) => exist.product.id === i.product.id)
                                    )
                                    const newSet = new Set(selectedItemIds)
                                    if (e.target.checked) {
                                      available.forEach((i: any) => newSet.add(i.id))
                                    } else {
                                      available.forEach((i: any) => newSet.delete(i.id))
                                    }
                                    setSelectedItemIds(newSet)
                                  }}
                                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 accent-orange-600"
                                />
                              </th>
                              <th className="py-2.5 px-3">Code</th>
                              <th className="py-2.5 px-3">Description</th>
                              <th className="py-2.5 px-3 text-center">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {importQuotations
                              .find((q) => q.id === selectedQuotId)
                              ?.items.filter((i: any) => {
                                if (!importItemSearch) return true
                                const term = importItemSearch.toLowerCase()
                                return (
                                  i.product.materialCode?.toLowerCase().includes(term) ||
                                  i.product.materialDescription?.toLowerCase().includes(term)
                                )
                              })
                              .map((item: any) => {
                                const isAdded = items.some(
                                  (exist) => exist.product.id === item.product.id
                                )
                                return (
                                  <tr
                                    key={item.id}
                                    className={`hover:bg-slate-50 ${
                                      isAdded ? "opacity-50 bg-slate-50" : ""
                                    }`}
                                  >
                                    <td className="py-2.5 px-3 align-top">
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
                                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 accent-orange-600 mt-1"
                                      />
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-800 align-top">
                                      {item.product.materialCode}
                                    </td>
                                    <td className="py-2.5 px-3 align-top">
                                      <div className="font-medium text-slate-900 text-xs">
                                        {item.product.materialDescription}
                                      </div>
                                      {isAdded && (
                                        <span className="inline-block text-[10px] font-bold text-emerald-600 mt-0.5">
                                          ALREADY ADDED
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono text-xs font-bold text-slate-900 align-top">
                                      {item.quantity}
                                    </td>
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

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setIsImportQuotModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSelectedItems}
                disabled={selectedItemIds.size === 0}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <span className="text-white">
                  Import {selectedItemIds.size > 0 ? `(${selectedItemIds.size})` : ""} Items
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
