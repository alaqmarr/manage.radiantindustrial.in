"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createCoc, updateCoc } from "@/app/actions/coc"
import { createQuickProduct } from "@/app/actions/product"
import { Loader2, Plus, Trash2, X, Check, Search, FileText, Sparkles } from "lucide-react"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { formatShortId } from "@/lib/utils"
import { sileo } from "sileo"

type Client = { id: string; name: string }
type Product = {
  id: string
  materialCode: string
  materialDescription: string
  unit: string
  specification?: string | null
}

export function CocForm({
  clients,
  products,
  quotations = [],
  initialData,
  defaultCocMessage,
}: {
  clients: Client[]
  products: Product[]
  quotations?: any[]
  initialData?: any
  defaultCocMessage: string
}) {
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE")

  const [selectedClientId, setSelectedClientId] = useState(initialData?.clientId || "")
  const [date, setDate] = useState(
    initialData?.date
      ? new Date(initialData.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  )
  const [cocNumber, setCocNumber] = useState(initialData?.cocNumber || "")
  const [quotationId, setQuotationId] = useState(initialData?.quotationId || "")
  const [clientPoRef, setClientPoRef] = useState(initialData?.clientPoRef || "")
  const [remarks, setRemarks] = useState(initialData?.remarks || "")
  const [standardText, setStandardText] = useState(initialData?.standardText || defaultCocMessage)

  const [items, setItems] = useState<
    {
      product: Product
      quantity: number
      batchNo: string
      remarks?: string
      attributes: { key: string; value: string }[]
    }[]
  >(
    initialData?.items?.map((item: any) => {
      let parsedAttributes = []
      try {
        parsedAttributes =
          typeof item.attributes === "string"
            ? JSON.parse(item.attributes)
            : Array.isArray(item.attributes)
            ? item.attributes
            : []
      } catch (e) {}
      return {
        product: item.product,
        quantity: item.quantity,
        batchNo: item.batchNo || "",
        remarks: item.remarks || "",
        attributes: parsedAttributes,
      }
    }) || []
  )

  const [searchTerm, setSearchTerm] = useState("")
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdDesc, setNewProdDesc] = useState("")
  const [newProdUnit, setNewProdUnit] = useState("NUM")
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  const handleSelectQuotationToImport = (qId: string) => {
    setQuotationId(qId)
    if (!qId) return
    const quot = quotations.find((q) => q.id === qId)
    if (!quot) return

    if (!selectedClientId) {
      setSelectedClientId(quot.clientId)
    }
    if (!clientPoRef && quot.prNo) {
      setClientPoRef(quot.prNo)
    }

    if (quot.items && quot.items.length > 0) {
      setItems((prev) => {
        const next = [...prev]
        let added = 0
        for (const qItem of quot.items) {
          if (qItem.isConfirmed === false) continue
          if (!next.some((existing) => existing.product.id === qItem.product.id)) {
            next.push({
              product: qItem.product,
              quantity: qItem.quantity,
              batchNo: "",
              remarks: "Verified & Compliant",
              attributes: [],
            })
            added++
          }
        }
        if (added > 0) {
          sileo.success({
            title: "Imported Quotation Items",
            description: `Added ${added} confirmed item(s) from Quotation #${formatShortId(quot.id)}.`,
          })
        }
        return next
      })
    }
  }

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
        sileo.success({
          title: "Product Created",
          description: `${res.product.materialCode} added to certificate.`,
        })
      } else {
        sileo.error({
          title: "Product Creation Failed",
          description: res.error || "Failed to create product",
        })
      }
    } catch (e) {
      sileo.error({ title: "Error", description: "Failed to create product" })
    } finally {
      setIsCreatingProduct(false)
    }
  }

  const filteredProducts = searchTerm
    ? products
        .filter(
          (p) =>
            p.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.materialDescription.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, 10)
    : []

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
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      addItem(filteredProducts[highlightedIndex])
    }
  }

  const addItem = (product: Product) => {
    setItems((prev) => [
      ...prev,
      { product, quantity: 1, batchNo: "", remarks: "Verified & Compliant", attributes: [] },
    ])
    setSearchTerm("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const handleSave = async () => {
    if (!selectedClientId) {
      sileo.warning({
        title: "Client Required",
        description: "Please select a client for this certificate.",
      })
      return
    }
    if (items.length === 0) {
      sileo.warning({
        title: "Items Required",
        description: "Please add at least one certified item.",
      })
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
      items: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        batchNo: item.batchNo,
        remarks: item.remarks,
        attributes: JSON.stringify(item.attributes),
      })),
    }

    try {
      let res
      if (initialData?.id) {
        res = await updateCoc(initialData.id, data)
      } else {
        res = await createCoc(data)
      }

      if (res.success) {
        setSaveStatus("SAVED")
        sileo.success({
          title: "Certificate Saved",
          description: "Certificate of Conformance has been saved.",
        })
        if (!initialData?.id) {
          router.push(`/cocs/${(res as any).id}`)
        } else {
          setTimeout(() => setSaveStatus("IDLE"), 2000)
        }
      } else {
        setSaveStatus("ERROR")
        sileo.error({ title: "Save Failed", description: res.error || "Failed to save COC" })
      }
    } catch (e) {
      setSaveStatus("ERROR")
      sileo.error({
        title: "Unexpected Error",
        description: "An unexpected error occurred while saving COC.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const clientQuotations = selectedClientId
    ? quotations.filter((q) => q.clientId === selectedClientId)
    : quotations

  return (
    <div className="space-y-6 pb-32">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              1. Certificate & Client Metadata
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Select the client or import items directly from an existing quotation.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Check className="w-4 h-4 text-white" />
            )}
            <span className="text-white">
              {saveStatus === "SAVING"
                ? "Saving..."
                : saveStatus === "SAVED"
                ? "Saved!"
                : "Save Certificate"}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Client <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Certificate Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              COC Number (Auto if blank)
            </label>
            <input
              type="text"
              value={cocNumber}
              onChange={(e) => setCocNumber(e.target.value)}
              placeholder="e.g. COC-2026-001"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Link & Auto-Import from Quotation (Optional)
            </label>
            <select
              value={quotationId}
              onChange={(e) => handleSelectQuotationToImport(e.target.value)}
              className="w-full bg-teal-50/40 border border-teal-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="">-- Select Quotation to Link & Import Items --</option>
              {clientQuotations.map((q) => (
                <option key={q.id} value={q.id}>
                  #{formatShortId(q.id)} — {q.client?.name}{" "}
                  {q.prNo ? `(PR: ${q.prNo})` : ""} •{" "}
                  {(q.items || []).filter((i: any) => i.isConfirmed !== false).length} items
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Client PO / PR Reference (Optional)
            </label>
            <input
              type="text"
              value={clientPoRef}
              onChange={(e) => setClientPoRef(e.target.value)}
              placeholder="e.g. PO-45920"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Certificate Remarks (Optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              placeholder="General inspection or dispatch remarks about this certificate..."
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Standard Certification Statement
          </label>
          <textarea
            value={standardText}
            onChange={(e) => setStandardText(e.target.value)}
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            This statement appears at the top of the printed Certificate of Conformance.
          </p>
        </div>
      </div>

      {/* Certified Items Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              2. Certified Materials & Batch / Lot Numbers ({items.length})
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Add the products, quantities, batch numbers, and custom test parameters covered by this certificate.
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const defaultBatch = `LOT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
                setItems((prev) =>
                  prev.map((i) => ({
                    ...i,
                    batchNo: i.batchNo || defaultBatch,
                    remarks: i.remarks || "Verified & Compliant",
                  }))
                )
                sileo.success({
                  title: "Batch & Remarks Auto-Filled",
                  description: `Populated default Batch (${defaultBatch}) and inspection remarks for empty rows.`,
                })
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Auto-Fill Empty Batch / Remarks
            </button>
          )}
        </div>

        <div className="relative" ref={autocompleteRef}>
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search products by code or description to add to certificate..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsDropdownOpen(true)
              setHighlightedIndex(-1)
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />

          {isDropdownOpen && searchTerm && (
            <div className="absolute z-20 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto overflow-x-hidden">
              {filteredProducts.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {filteredProducts.map((product, index) => (
                    <li
                      key={product.id}
                      onClick={() => addItem(product)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                        highlightedIndex === index ? "bg-teal-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-teal-700">
                          {product.materialCode}
                        </div>
                        <div className="text-slate-900 text-sm font-medium line-clamp-1">
                          {product.materialDescription}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-teal-600" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-slate-500 text-sm mb-3">
                    No products found matching &ldquo;{searchTerm}&rdquo;
                  </p>
                  <button
                    onClick={() => {
                      setNewProdCode(searchTerm.toUpperCase())
                      setNewProdDesc("")
                      setIsProductModalOpen(true)
                      setIsDropdownOpen(false)
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">Create New Product</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4 min-w-[240px]">Product & Custom Test Fields</th>
                    <th className="py-3 px-4 w-36">Certified Qty</th>
                    <th className="py-3 px-4 w-48">Batch / Lot No</th>
                    <th className="py-3 px-4">Inspection Remarks</th>
                    <th className="py-3 px-4 w-16 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">{index + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-teal-700 font-bold text-xs mb-0.5">
                          {item.product.materialCode}
                        </div>
                        <div
                          className="text-slate-900 font-semibold line-clamp-2"
                          title={item.product.materialDescription}
                        >
                          {item.product.materialDescription}
                        </div>
                        {item.product.specification && (
                          <div className="text-slate-500 text-xs mt-0.5 line-clamp-1">
                            {item.product.specification}
                          </div>
                        )}
                        <div className="mt-2.5 space-y-1.5">
                          {item.attributes.map((attr, attrIdx) => (
                            <div key={attrIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Field (e.g. Serial No)"
                                value={attr.key}
                                onChange={(e) => {
                                  const newAttrs = [...item.attributes]
                                  newAttrs[attrIdx].key = e.target.value
                                  updateItem(index, "attributes", newAttrs)
                                }}
                                className="w-1/3 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                              />
                              <input
                                type="text"
                                placeholder="Value"
                                value={attr.value}
                                onChange={(e) => {
                                  const newAttrs = [...item.attributes]
                                  newAttrs[attrIdx].value = e.target.value
                                  updateItem(index, "attributes", newAttrs)
                                }}
                                className="w-1/2 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                              />
                              <button
                                onClick={() => {
                                  const newAttrs = item.attributes.filter((_, i) => i !== attrIdx)
                                  updateItem(index, "attributes", newAttrs)
                                }}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newAttrs = [...item.attributes, { key: "", value: "" }]
                              updateItem(index, "attributes", newAttrs)
                            }}
                            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add Custom Attribute (Serial / Test Value)
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <SmartNumberInput
                            value={item.quantity || ""}
                            maxDecimals={3}
                            onValueChange={(num) => updateItem(index, "quantity", num)}
                            className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                          />
                          <span className="text-xs font-mono text-slate-500">
                            {item.product.unit}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={item.batchNo}
                          onChange={(e) => updateItem(index, "batchNo", e.target.value)}
                          placeholder="e.g. LOT-2026-01"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-500"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => updateItem(index, "remarks", e.target.value)}
                          placeholder="e.g. Verified & Compliant"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remove item"
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
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No certified items added yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Select a Quotation above to auto-import all its items, or search the product catalog above.
            </p>
          </div>
        )}
      </div>

      {/* Product Creation Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900">Quick Create Product</h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Material Code
                </label>
                <input
                  type="text"
                  value={newProdCode}
                  onChange={(e) => setNewProdCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <textarea
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Unit of Measure
                </label>
                <select
                  value={newProdUnit}
                  onChange={(e) => setNewProdUnit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                >
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
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors"
              >
                <span className="text-white">
                  {isCreatingProduct ? "Creating..." : "Save Product & Add"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
