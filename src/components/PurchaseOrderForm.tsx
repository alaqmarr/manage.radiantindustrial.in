"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createPurchaseOrder, updatePurchaseOrder } from "@/app/actions/purchaseOrder"
import { createSupplier } from "@/app/actions/supplier"
import { ProductModal } from "./ProductModal"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { formatRupee, formatShortId } from "@/lib/utils"
import {
  Loader2,
  Plus,
  Trash2,
  X,
  Check,
  Search,
  AlertTriangle,
  Info,
  ClipboardList
} from "lucide-react"
import { verifyGSTAction } from "@/app/actions/gst"
import { sileo } from "sileo"
import Link from "next/link"

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

export function PurchaseOrderForm({
  suppliers: initialSuppliers,
  products,
  initialData,
  quotations = [],
  rfqs = [],
  initialRfq,
  initialQuotationId,
}: {
  suppliers: Supplier[]
  products: Product[]
  initialData?: any
  quotations?: any[]
  rfqs?: any[]
  initialRfq?: any
  initialQuotationId?: string
}) {
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [poId] = useState(initialData?.id || "")
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE")

  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [selectedSupplierId, setSelectedSupplierId] = useState(
    initialData?.supplierId || initialRfq?.supplierId || ""
  )

  const [paymentTerms, setPaymentTerms] = useState(initialData?.paymentTerms || "")
  const [deliveryTerms, setDeliveryTerms] = useState(initialData?.deliveryTerms || "")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    initialData?.expectedDeliveryDate
      ? new Date(initialData.expectedDeliveryDate).toISOString().split("T")[0]
      : ""
  )
  const [notes, setNotes] = useState(initialData?.notes || "")
  const [rfqId, setRfqId] = useState(initialData?.rfqId || initialRfq?.id || "")
  const [poNumber, setPoNumber] = useState(initialData?.poNumber || "")
  const [quotationId, setQuotationId] = useState(
    initialData?.quotationId || initialQuotationId || ""
  )

  const initialItems =
    initialData?.items?.map((item: any) => ({
      product: {
        ...item.product,
        materialDescription: item.itemDescription || item.product.materialDescription,
      },
      quantity: item.quantity,
      unitPrice: item.unitPrice / 100,
      gstRate: item.gstRate,
      comment: item.comment || undefined,
    })) ||
    initialRfq?.items?.map((item: any) => ({
      product: {
        ...item.product,
        materialDescription: item.itemDescription || item.product.materialDescription,
      },
      quantity: item.quantity,
      unitPrice: item.product.costPrice ? item.product.costPrice / 100 : 0,
      gstRate: item.product.gstRate,
      comment: item.comment || undefined,
    })) ||
    []

  const [items, setItems] = useState<
    {
      product: Product
      quantity: number
      unitPrice: number
      gstRate: number
      comment?: string
    }[]
  >(initialItems)

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

  const [newSupplierGst, setNewSupplierGst] = useState("")
  const [newSupplierLocation, setNewSupplierLocation] = useState("")
  const [isVerifyingGST, setIsVerifyingGST] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const didInitQuotation = useRef(false)

  // Helper to compute ordered quantities per product for a quotation (excluding current PO if editing)
  const getQuotationFulfillment = (q: any) => {
    const activePos = (q?.purchaseOrders || []).filter((p: any) => p.id !== poId)
    const orderedByProduct = new Map<string, number>()
    for (const p of activePos) {
      for (const item of p.items || []) {
        orderedByProduct.set(item.productId, (orderedByProduct.get(item.productId) || 0) + item.quantity)
      }
    }
    const qItems = (q?.items || []).filter((qi: any) => qi.isConfirmed !== false)
    const requiredByProduct = new Map<string, number>()
    for (const qi of qItems) {
      requiredByProduct.set(qi.product.id, (requiredByProduct.get(qi.product.id) || 0) + qi.quantity)
    }

    const isFullyOrdered =
      qItems.length > 0 &&
      Array.from(requiredByProduct.entries()).every(
        ([prodId, reqQty]) => (orderedByProduct.get(prodId) || 0) >= reqQty
      )
    const isPartiallyOrdered =
      !isFullyOrdered &&
      qItems.some((qi: any) => (orderedByProduct.get(qi.product.id) || 0) > 0)

    return {
      activePos,
      orderedByProduct,
      isFullyOrdered,
      isPartiallyOrdered,
    }
  }

  // Auto-populate when opened via /purchase-orders/new?quotationId=...
  useEffect(() => {
    if (didInitQuotation.current) return
    if (initialQuotationId && !initialData) {
      didInitQuotation.current = true
      applyQuotationSelection(initialQuotationId, true)
    }
  }, [initialQuotationId, initialData])

  const applyQuotationSelection = (qId: string, isInitialLoad = false) => {
    setQuotationId(qId)
    if (!qId) return

    const selectedQ = quotations.find((q: any) => q.id === qId)
    if (!selectedQ || !selectedQ.items) return

    const { activePos, orderedByProduct, isFullyOrdered } = getQuotationFulfillment(selectedQ)

    if (isFullyOrdered) {
      const poNums = activePos
        .map((p: any) => `#${p.poNumber || formatShortId(p.id)} (${p.supplier?.name || "Vendor"})`)
        .join(", ")
      sileo.warning({
        title: "Duplicate PO Prevented",
        description: `All confirmed items in Quotation #${formatShortId(
          selectedQ.id
        )} are already ordered in existing PO(s): ${poNums}.`,
      })
      return
    }

    const remainingItems: {
      product: Product
      quantity: number
      unitPrice: number
      gstRate: number
      comment?: string
    }[] = []

    let firstSupplierId = ""
    const consumedOrderMap = new Map<string, number>(orderedByProduct)
    for (const qi of selectedQ.items) {
      if (qi.isConfirmed === false) continue
      const alreadyOrdered = consumedOrderMap.get(qi.product.id) || 0
      const usedFromExisting = Math.min(alreadyOrdered, qi.quantity)
      consumedOrderMap.set(qi.product.id, Math.max(0, alreadyOrdered - usedFromExisting))
      const remainingQty = Math.max(0, Number((qi.quantity - usedFromExisting).toFixed(4)))
      if (remainingQty > 0) {
        if (!firstSupplierId && qi.supplierId) {
          firstSupplierId = qi.supplierId
        }
        remainingItems.push({
          product: {
            ...qi.product,
            materialDescription: qi.itemDescription || qi.product.materialDescription,
            unit: qi.itemUnit || qi.product.unit,
          },
          quantity: remainingQty,
          unitPrice: (qi.cpSnapshot || qi.product.costPrice || 0) / 100,
          gstRate: qi.product.gstRate,
          comment: qi.comment || undefined,
        })
      }
    }

    if (firstSupplierId && !selectedSupplierId) {
      setSelectedSupplierId(firstSupplierId)
    }

    setItems(remainingItems)

    if (!isInitialLoad) {
      sileo.info({
        title: "Quotation Items Loaded",
        description: `Populated ${remainingItems.length} confirmed un-ordered item(s) from Quotation #${formatShortId(
          selectedQ.id
        )}.`,
      })
    }
  }

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
        sileo.error({
          title: "GST Verification Failed",
          description: res.error,
        })
      } else if (res.data) {
        setNewSupplierName(res.data.name || newSupplierName)
        setNewSupplierLocation(res.data.location || res.data.address || newSupplierLocation)
        sileo.success({
          title: "GSTIN Verified",
          description: `Fetched vendor details for ${res.data.name || res.data.legalName}.`,
        })
      }
    } catch {
      sileo.error({
        title: "GST Verification Failed",
        description: "Failed to verify GST number.",
      })
    } finally {
      setIsVerifyingGST(false)
    }
  }

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
        setSuppliers((prev) => [...prev, res.supplier].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedSupplierId(res.supplier.id)
        setIsSupplierModalOpen(false)
        setNewSupplierName("")
        setNewSupplierContact("")
        setNewSupplierGst("")
        setNewSupplierLocation("")
        sileo.success({
          title: "Supplier Created",
          description: `${res.supplier.name} has been added and selected.`,
        })
      } else {
        sileo.error({
          title: "Failed to Create Supplier",
          description: res.error || "Could not create supplier.",
        })
      }
    } catch {
      sileo.error({
        title: "Failed to Create Supplier",
        description: "An unexpected error occurred.",
      })
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
        addProductToPO(filteredProducts[highlightedIndex])
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false)
    }
  }

  const addProductToPO = (product: Product, quantity = 1, unitPrice = 0) => {
    setItems((prev) => [
      ...prev,
      {
        product: { ...product },
        quantity,
        unitPrice: unitPrice > 0 ? unitPrice : product.costPrice / 100,
        gstRate: product.gstRate,
      },
    ])
    setSearchTerm("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleItemChange = (
    index: number,
    field: "quantity" | "unitPrice" | "gstRate" | "comment",
    value: any
  ) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    )
  }

  const handleProductChange = (
    index: number,
    field: "materialCode" | "materialDescription" | "unit",
    value: any
  ) => {
    setItems((prev) =>
      prev.map((i, idx) =>
        idx === index
          ? {
              ...i,
              product: { ...i.product, [field]: value },
            }
          : i
      )
    )
  }

  const selectedQuotationObj = quotations.find((q: any) => q.id === quotationId)
  const selectedQuotationFulfillment = selectedQuotationObj
    ? getQuotationFulfillment(selectedQuotationObj)
    : null

  const handleSubmit = async (status: string) => {
    if (!selectedSupplierId) {
      sileo.warning({
        title: "Supplier Required",
        description: "Please select or add a supplier for this Purchase Order.",
      })
      return
    }
    if (items.length === 0) {
      sileo.warning({
        title: "Items Required",
        description: "Please add at least one item to the Purchase Order.",
      })
      return
    }

    // Client-side duplicate PO check for linked quotation
    if (selectedQuotationObj && selectedQuotationFulfillment?.isFullyOrdered) {
      sileo.error({
        title: "Duplicate PO Blocked",
        description:
          "All items for the selected quotation have already been ordered in active Purchase Orders.",
      })
      return
    }

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
        quotationId: quotationId || undefined,
        poNumber: poNumber || undefined,
        items: items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice * 100),
          gstRate: item.gstRate,
          comment: item.comment,
        })),
      }

      let result
      if (poId) {
        result = await updatePurchaseOrder(poId, payload)
      } else {
        result = await createPurchaseOrder(payload)
      }

      if (result.error) {
        throw new Error(result.error)
      }

      setSaveStatus("SAVED")
      sileo.success({
        title: poId ? "Purchase Order Updated" : "Purchase Order Created",
        description: `Purchase Order has been ${status === "DRAFT" ? "saved as draft" : "issued"}.`,
      })
      router.push(`/purchase-orders/${result.id || poId}`)
      router.refresh()
    } catch (error: any) {
      console.error(error)
      sileo.error({
        title: "Cannot Save Purchase Order",
        description: error.message || "Something went wrong.",
      })
      setSaveStatus("ERROR")
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalAmount = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)
  const totalGst = items.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice * (item.gstRate / 100),
    0
  )

  return (
    <div className="space-y-6 pb-28">
      {/* Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add New Supplier</h3>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  GST Number (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    value={newSupplierGst}
                    onChange={(e) => setNewSupplierGst(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                    placeholder="e.g. 36AAAAA0000A1Z5"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyGST}
                    disabled={isVerifyingGST}
                    className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier Name *
                </label>
                <input
                  autoFocus
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Location / Address
                </label>
                <input
                  value={newSupplierLocation}
                  onChange={(e) => setNewSupplierLocation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Contact (Phone / Email)
                </label>
                <input
                  value={newSupplierContact}
                  onChange={(e) => setNewSupplierContact(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateSupplier}
                disabled={isCreatingSupplier || !newSupplierName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors mt-2 cursor-pointer"
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

      {/* Duplicate / Existing PO Alert Banner for Selected Quotation */}
      {selectedQuotationObj &&
        selectedQuotationFulfillment &&
        selectedQuotationFulfillment.activePos.length > 0 && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              selectedQuotationFulfillment.isFullyOrdered
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : "bg-blue-50 border-blue-200 text-blue-900"
            }`}
          >
            {selectedQuotationFulfillment.isFullyOrdered ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs space-y-1.5">
              <div className="font-bold text-sm">
                {selectedQuotationFulfillment.isFullyOrdered
                  ? "Duplicate PO Prevention: All items in this Quotation are already ordered"
                  : "Existing Purchase Orders Found for this Quotation (Partially Ordered)"}
              </div>
              <p>
                Quotation{" "}
                <strong>
                  #{formatShortId(selectedQuotationObj.id)}
                </strong>{" "}
                ({selectedQuotationObj.client?.name}) already has{" "}
                <strong>{selectedQuotationFulfillment.activePos.length}</strong> active Purchase
                Order(s):
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedQuotationFulfillment.activePos.map((existingPo: any) => (
                  <Link
                    key={existingPo.id}
                    href={`/purchase-orders/${existingPo.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800 font-semibold hover:border-orange-400 transition-colors"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-orange-600" />
                    <span>
                      PO #{existingPo.poNumber || formatShortId(existingPo.id)} •{" "}
                      {existingPo.supplier?.name || "Vendor"} ({existingPo.status})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

      {/* PO Metadata Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Supplier / Vendor *
            </label>
            <div className="flex gap-2">
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              >
                <option value="">Select a Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(true)}
                className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                title="Add New Supplier"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Fulfilling Quotation (Optional)
            </label>
            <select
              value={quotationId}
              onChange={(e) => applyQuotationSelection(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            >
              <option value="">Not linked to a Quotation</option>
              {quotations.map((q) => {
                const f = getQuotationFulfillment(q)
                const badge = f.isFullyOrdered
                  ? " [Fully Ordered]"
                  : f.isPartiallyOrdered
                  ? ` [Partial - ${f.activePos.length} PO]`
                  : ""
                return (
                  <option key={q.id} value={q.id}>
                    #{formatShortId(q.id)} {q.prNo ? `(${q.prNo}) ` : ""}— {q.client?.name}
                    {badge}
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Linked Vendor RFQ (Optional)
            </label>
            <select
              value={rfqId}
              onChange={(e) => setRfqId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            >
              <option value="">Not linked to an RFQ</option>
              {rfqs.map((r: any) => (
                <option key={r.id} value={r.id}>
                  RFQ #{formatShortId(r.id)} — {r.supplier?.name || "General"} (
                  {new Date(r.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Custom PO Number (Optional)
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              placeholder="Auto-generated if left blank"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Payment Terms
            </label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              placeholder="e.g. 100% Against Delivery / Net 30"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Delivery Terms
            </label>
            <input
              type="text"
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              placeholder="e.g. Door Delivery at Secunderabad"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Special Instructions / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              placeholder="Dispatch instructions, test certificate requirements, etc."
            />
          </div>
        </div>
      </div>

      {/* Purchase Items Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Purchase Order Line Items</h2>
            <p className="text-xs text-slate-500">
              Add materials to order and verify unit purchase rates and GST percentages.
            </p>
          </div>
        </div>

        <div className="relative z-[55]" ref={autocompleteRef}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                placeholder="Search products by material code or description..."
                className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 shadow-2xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsProductModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Add New Catalog Product"
            >
              <Plus className="w-4 h-4 text-white" />
              <span className="text-white">New Product</span>
            </button>
          </div>

          <ProductModal
            forceOpen={isProductModalOpen}
            onForceClose={() => setIsProductModalOpen(false)}
            onSuccess={(p: any) => {
              addProductToPO(p)
              setIsProductModalOpen(false)
            }}
          />

          {isDropdownOpen && searchTerm && (
            <ul className="absolute z-[60] mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <li className="px-4 py-3 text-slate-500 text-xs">No products found.</li>
              ) : (
                filteredProducts.map((p, idx) => (
                  <li
                    key={p.id}
                    onClick={() => addProductToPO(p)}
                    className={`px-4 py-2.5 cursor-pointer hover:bg-orange-50/70 flex items-center justify-between ${
                      highlightedIndex === idx ? "bg-orange-50" : ""
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold font-mono text-slate-900">
                        {p.materialCode}
                      </div>
                      <div className="text-xs text-slate-600 truncate">{p.materialDescription}</div>
                    </div>
                    <div className="text-xs font-mono text-slate-500">
                      CP: {formatRupee(p.costPrice)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-3 mt-4">
            {items.map((item, idx) => (
              <div
                key={`${item.product.id}-${idx}`}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                      <input
                        type="text"
                        value={item.product.materialCode}
                        onChange={(e) =>
                          handleProductChange(idx, "materialCode", e.target.value)
                        }
                        className="sm:w-40 bg-slate-50 border border-slate-300 focus:bg-white focus:border-orange-600 px-3 py-1.5 font-mono text-xs font-semibold text-slate-900 rounded-lg focus:outline-none"
                      />
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
                        className="flex-1 bg-slate-50 border border-slate-300 focus:bg-white focus:border-orange-600 px-3 py-1.5 text-sm font-medium text-slate-900 rounded-lg focus:outline-none"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Add line item specification or remark..."
                      value={item.comment || ""}
                      onChange={(e) => handleItemChange(idx, "comment", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-600 px-3 py-1.5 text-xs text-slate-700 rounded-lg focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                      Order Quantity
                    </label>
                    <div className="flex items-center gap-2">
                      <SmartNumberInput
                        value={item.quantity}
                        onValueChange={(val) =>
                          handleItemChange(idx, "quantity", val || 0)
                        }
                        placeholder="Qty (e.g. 10+5)"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:border-orange-600"
                      />
                      <span className="text-xs font-mono font-semibold text-slate-500">
                        {item.product.unit}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                      Unit Purchase Rate (₹)
                    </label>
                    <SmartNumberInput
                      value={item.unitPrice}
                      onValueChange={(val) =>
                        handleItemChange(idx, "unitPrice", val || 0)
                      }
                      placeholder="Rate (e.g. 450+50)"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:border-orange-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                      GST Rate (%)
                    </label>
                    <SmartNumberInput
                      value={item.gstRate}
                      onValueChange={(val) =>
                        handleItemChange(idx, "gstRate", val || 0)
                      }
                      placeholder="18"
                      className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-orange-600"
                    />
                  </div>

                  <div className="text-right">
                    <label className="block text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                      Line Amount (Excl. GST)
                    </label>
                    <div className="py-1.5 text-base font-mono font-bold text-slate-900">
                      {formatRupee(Math.round(item.quantity * item.unitPrice * 100))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Summary & Actions */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div>
              <span className="text-xs text-slate-500 uppercase font-bold">Subtotal:</span>
              <span className="ml-2 text-slate-900 font-mono font-bold">
                {formatRupee(Math.round(totalAmount * 100))}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-bold">Total GST:</span>
              <span className="ml-2 text-slate-700 font-mono font-semibold">
                {formatRupee(Math.round(totalGst * 100))}
              </span>
            </div>
            <div className="pl-4 border-l border-slate-200">
              <span className="text-xs text-orange-600 uppercase font-bold">Grand Total:</span>
              <span className="ml-2 text-orange-600 font-mono font-black text-lg">
                {formatRupee(Math.round((totalAmount + totalGst) * 100))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleSubmit("DRAFT")}
              disabled={isSubmitting}
              className="px-5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors border border-slate-300 disabled:opacity-50 cursor-pointer"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("ISSUED")}
              disabled={isSubmitting || Boolean(selectedQuotationFulfillment?.isFullyOrdered)}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Check className="w-4 h-4 text-white" />
              )}
              <span className="text-white">{poId ? "Update PO" : "Issue Purchase Order"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
