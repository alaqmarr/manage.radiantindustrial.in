"use client"
import { useState, useRef, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { createPurchase, updatePurchase } from "@/app/actions/purchase"
import { Loader2, X, Plus, Search, Trash2, Check } from "lucide-react"
import { formatRupee, formatShortId } from "@/lib/utils"
import { SupplierModal } from "./SupplierModal"
import { ProductModal } from "./ProductModal"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { sileo } from "sileo"

type Supplier = { id: string; name: string }
type Product = {
  id: string
  materialCode: string
  materialDescription: string
  costPrice: number
}

export function PurchaseModal({
  suppliers,
  products,
  purchases,
  quotations,
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
  const urlQuotationId = searchParams.get("quotationId")

  const isEditing = action === "edit-purchase"
  const purchaseToEdit =
    isEditing && purchases ? purchases.find((p) => p.id === editId) : null

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [selectedQuotationId, setSelectedQuotationId] = useState("")
  const [items, setItems] = useState<
    {
      product: Product
      quantity: number
      cpSnapshot: number
    }[]
  >([])

  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)

  useEffect(() => {
    setLocalSuppliers(suppliers)
  }, [suppliers])

  const handleClose = () => {
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.delete("action")
    newParams.delete("id")
    newParams.delete("quotationId")
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false })
  }

  const getQuotationFulfillment = (q: any) => {
    const activePos = q?.purchaseOrders || []
    const activePurchases = (q?.purchases || []).filter((p: any) => p.id !== editId)
    const orderedByProduct = new Map<string, number>()

    for (const po of activePos) {
      for (const pi of po.items || []) {
        orderedByProduct.set(
          pi.productId,
          (orderedByProduct.get(pi.productId) || 0) + (Number(pi.quantity) || 0)
        )
      }
    }
    for (const pur of activePurchases) {
      for (const pi of pur.items || []) {
        orderedByProduct.set(
          pi.productId,
          (orderedByProduct.get(pi.productId) || 0) + (Number(pi.quantity) || 0)
        )
      }
    }

    const confirmedItems = (q?.items || []).filter((qi: any) => qi.isConfirmed !== false)
    const requiredByProduct = new Map<string, number>()
    for (const qi of confirmedItems) {
      const pid = qi.product?.id || qi.productId
      requiredByProduct.set(pid, (requiredByProduct.get(pid) || 0) + (Number(qi.quantity) || 0))
    }

    const isFullyOrdered =
      confirmedItems.length > 0 &&
      Array.from(requiredByProduct.entries()).every(
        ([pid, reqQty]) => (orderedByProduct.get(pid) || 0) >= reqQty
      )

    const isPartiallyOrdered =
      !isFullyOrdered &&
      confirmedItems.some((qi: any) => (orderedByProduct.get(qi.product?.id || qi.productId) || 0) > 0)

    return {
      activePos,
      activePurchases,
      orderedByProduct,
      isFullyOrdered,
      isPartiallyOrdered,
    }
  }

  const handleQuotationChange = (qId: string, isInitialLoad = false) => {
    setSelectedQuotationId(qId)
    if (!qId) return
    const q = quotations?.find((x) => x.id === qId)
    if (q && q.items) {
      const { activePos, activePurchases, orderedByProduct, isFullyOrdered } = getQuotationFulfillment(q)
      if (isFullyOrdered) {
        const sourceLabels = [
          ...activePos.map((p: any) => `PO #${p.poNumber || formatShortId(p.id)}`),
          ...activePurchases.map((pur: any) => `Bill #${formatShortId(pur.id)}`),
        ].join(", ")
        sileo.warning({
          title: "All Items Already Procured",
          description: `All confirmed items in Quotation #${formatShortId(q.id)} are already ordered/purchased (${sourceLabels}).`,
        })
        setItems([])
        return
      }

      const consumedMap = new Map<string, number>(orderedByProduct)
      const remainingItems: {
        product: Product
        quantity: number
        cpSnapshot: number
      }[] = []
      let firstSupplierId = ""

      for (const qi of q.items) {
        if (qi.isConfirmed === false) continue
        const pid = qi.product.id
        const alreadyOrdered = consumedMap.get(pid) || 0
        const used = Math.min(alreadyOrdered, qi.quantity)
        consumedMap.set(pid, Math.max(0, alreadyOrdered - used))
        const remainingQty = Math.max(0, Number((qi.quantity - used).toFixed(4)))
        if (remainingQty > 0) {
          if (!firstSupplierId && qi.supplierId) {
            firstSupplierId = qi.supplierId
          }
          remainingItems.push({
            product: {
              ...qi.product,
              materialDescription: qi.itemDescription || qi.product.materialDescription,
            },
            quantity: remainingQty,
            cpSnapshot: qi.cpSnapshot || qi.product.costPrice || 0,
          })
        }
      }

      if (firstSupplierId && !selectedSupplierId) {
        setSelectedSupplierId(firstSupplierId)
      }
      setItems(remainingItems)

      if (!isInitialLoad && remainingItems.length > 0) {
        sileo.info({
          title: "Remaining Quotation Items Loaded",
          description: `Loaded ${remainingItems.length} un-procured item(s) from Quotation #${formatShortId(q.id)}.`,
        })
      }
    }
  }

  useEffect(() => {
    if (action === "new-purchase") {
      setSelectedSupplierId("")
      setSearchTerm("")
      if (urlQuotationId && quotations?.length) {
        handleQuotationChange(urlQuotationId, true)
      } else {
        setSelectedQuotationId("")
        setItems([])
      }
    } else if (purchaseToEdit) {
      setSelectedSupplierId(purchaseToEdit.supplierId || "")
      setSelectedQuotationId(purchaseToEdit.quotationId || "")
      setItems(
        purchaseToEdit.items.map((item: any) => ({
          product: item.product,
          quantity: item.quantity,
          cpSnapshot: item.cpSnapshot,
        }))
      )
      setSearchTerm("")
    }
  }, [action, purchaseToEdit, urlQuotationId])

  const [searchTerm, setSearchTerm] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

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
        addProductToPurchase(filteredProducts[highlightedIndex])
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false)
    }
  }

  const addProductToPurchase = (product: Product, quantity = 1) => {
    setItems((prev) => {
      if (prev.find((i) => i.product.id === product.id)) return prev
      return [
        ...prev,
        {
          product,
          quantity,
          cpSnapshot: product.costPrice,
        },
      ]
    })
    setSearchTerm("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
  }

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter((i) => i.product.id !== productId))
  }

  const handleQuantityChange = (productId: string, quantity: number) => {
    setItems(items.map((i) => (i.product.id === productId ? { ...i, quantity } : i)))
  }

  const handleCpChange = (productId: string, cpStr: string) => {
    const cp = Number(cpStr) * 100
    setItems(items.map((i) => (i.product.id === productId ? { ...i, cpSnapshot: cp } : i)))
  }

  const handleSubmit = async () => {
    if (!selectedSupplierId) {
      sileo.warning({
        title: "Supplier Required",
        description: "Please select a supplier for this purchase.",
      })
      return
    }
    if (items.length === 0) {
      sileo.warning({
        title: "Items Required",
        description: "Please add at least one item.",
      })
      return
    }
    if (items.some((i) => !i.cpSnapshot || i.cpSnapshot <= 0)) {
      sileo.warning({
        title: "Invalid Cost Price",
        description: "All items must have a valid cost price (CP) greater than zero.",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        supplierId: selectedSupplierId,
        quotationId: selectedQuotationId || undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          cpSnapshot: i.cpSnapshot,
        })),
      }

      const res =
        isEditing && editId
          ? await updatePurchase(editId, payload)
          : await createPurchase(payload)

      if (res.success) {
        sileo.success({
          title: isEditing ? "Purchase Updated" : "Purchase Recorded",
          description: `${items.length} item(s) recorded successfully.`,
        })
        router.refresh()
        handleClose()
      } else {
        sileo.error({
          title: "Save Failed",
          description: res.error || "Could not save purchase.",
        })
      }
    } catch (e: any) {
      sileo.error({
        title: "Error",
        description: "Something went wrong while recording the purchase.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (action !== "new-purchase" && action !== "edit-purchase") return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={handleClose} />

      <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 shadow-2xl relative z-10 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {isEditing ? "Edit Direct Purchase" : "Record Direct Purchase"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? "Update supplier and line items for this purchase."
                : "Record an off-the-shelf or cash purchase from a supplier."}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[380px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Supplier *
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">-- Select a Supplier --</option>
                  {localSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Add New Supplier"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tag Quotation (Optional)
              </label>
              <select
                value={selectedQuotationId}
                onChange={(e) => handleQuotationChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
              >
                <option value="">-- No Quotation Tagged --</option>
                {quotations?.map((q: any) => {
                  const f = getQuotationFulfillment(q)
                  const badge = f.isFullyOrdered
                    ? " [Fully Procured]"
                    : f.isPartiallyOrdered
                    ? ` [Partial - ${f.activePos.length} PO, ${f.activePurchases.length} Direct]`
                    : ""
                  return (
                    <option key={q.id} value={q.id}>
                      #{formatShortId(q.id)} {q.prNo ? `(${q.prNo}) ` : ""}- {q.client.name}
                      {badge}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full" />

          {/* Autocomplete */}
          <div className="relative" ref={autocompleteRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Search & Add Product *
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
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
                  placeholder="Search products by code or description..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(true)}
                className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-colors"
                title="Add New Product"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {isDropdownOpen && searchTerm && (
              <ul className="absolute z-20 mt-1.5 w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <li className="px-4 py-3 text-slate-500 text-xs">No products found.</li>
                ) : (
                  filteredProducts.map((p, idx) => (
                    <li
                      key={p.id}
                      onClick={() => addProductToPurchase(p)}
                      className={`px-4 py-2.5 cursor-pointer transition-colors ${
                        highlightedIndex === idx ? "bg-orange-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-mono font-bold text-orange-600">
                        {p.materialCode}
                      </div>
                      <div className="text-xs text-slate-800 truncate">{p.materialDescription}</div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 w-28">Qty</th>
                    <th className="px-4 py-3 w-36">Unit CP (₹)</th>
                    <th className="px-4 py-3 text-right">Total (₹)</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <tr key={item.product.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-900 font-mono text-xs font-bold">
                        {item.product.materialCode}
                      </td>
                      <td className="px-4 py-3 text-slate-800 text-xs font-medium">
                        {item.product.materialDescription}
                      </td>
                      <td className="px-4 py-3">
                        <SmartNumberInput
                          value={item.quantity}
                          maxDecimals={3}
                          onValueChange={(num) =>
                            handleQuantityChange(
                              item.product.id,
                              num > 0 ? num : 1
                            )
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-900 font-mono font-bold text-center text-xs focus:outline-none focus:border-orange-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <SmartNumberInput
                          value={item.cpSnapshot / 100}
                          onValueChange={(_, str) => handleCpChange(item.product.id, str)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-900 font-mono font-bold text-right text-xs focus:outline-none focus:border-orange-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 text-xs">
                        {formatRupee(item.cpSnapshot * item.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Total Purchase Value
                  </div>
                  <div className="text-xl font-black font-mono text-emerald-700">
                    {formatRupee(
                      items.reduce((sum, item) => sum + item.cpSnapshot * item.quantity, 0)
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl transition-colors border border-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || items.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Check className="w-4 h-4 text-white" />
            )}
            <span className="text-white">
              {isEditing ? "Update Purchase" : "Confirm Purchase"}
            </span>
          </button>
        </div>
      </div>

      <SupplierModal
        forceOpen={showSupplierModal}
        onForceClose={() => setShowSupplierModal(false)}
        onSuccess={(newSupplier: any) => {
          setLocalSuppliers((prev) => [...prev, newSupplier])
          setSelectedSupplierId(newSupplier.id)
          setShowSupplierModal(false)
        }}
      />

      <ProductModal
        forceOpen={isProductModalOpen}
        onForceClose={() => setIsProductModalOpen(false)}
        onSuccess={(p: any) => {
          addProductToPurchase(p)
          setIsProductModalOpen(false)
        }}
      />
    </div>
  )
}
