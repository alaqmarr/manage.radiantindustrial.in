"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createQuickProduct, saveProductSellingPrice } from "@/app/actions/product"
import { upsertDraftQuotation, getQuotationUpdatedAt } from "@/app/actions/quotation"
import { upsertDraftRfq } from "@/app/actions/rfq"
import { addProductSupplier, searchSuppliers } from "@/app/actions/supplier"
import { createClient } from "@/app/actions/client"
import { parseQuotationExcelAction } from "@/app/actions/import"
import { ProductModal } from "./ProductModal"
import { VendorPriceDialog } from "./VendorPriceDialog"
import { MarginIndicator } from "./MarginIndicator"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { formatRupee } from "@/lib/utils"
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  Check,
  AlertCircle,
  Search,
  History,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpDown,
  Zap,
  Calculator,
  Award,
  CopyPlus,
  Send,
  Sparkles,
} from "lucide-react"
import { verifyGSTAction } from "@/app/actions/gst"
import { sileo } from "sileo"

type Client = { id: string; name: string }
type ProductSupplierRate = {
  id?: string
  supplierId: string
  costPrice: number
  supplier?: { id: string; name: string }
}

type ProductQuotationHistoryItem = {
  id: string
  spSnapshot: number
  cpSnapshot?: number | null
  quantity?: number
  quotation?: {
    id: string
    clientId: string
    createdAt?: Date | string
    client?: { name: string }
  }
}

type Product = {
  id: string
  materialCode: string
  materialDescription: string
  costPrice?: number
  sellingPrice: number
  gstRate: number
  unit: string
  specification?: string | null
  commissionCostPrice?: number | null
  supplierId?: string | null
  productSuppliers?: ProductSupplierRate[]
  quotationItems?: ProductQuotationHistoryItem[]
}

type QuotationLineItem = {
  lineId: string
  product: Product
  quantity: number
  quotedQuantity?: number | null
  isConfirmed?: boolean
  itemsNo?: string
  cpSnapshot?: number
  commissionCpSnapshot?: number
  spSnapshot?: number
  supplierId?: string
  supplierName?: string
  comment?: string
  leadTime?: string
  additionalCost?: number
}

function createLineId() {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function getLowestVendorForProduct(product: Product): {
  costPrice: number
  supplierId?: string
  supplierName?: string
} | null {
  const validSuppliers = (product.productSuppliers || [])
    .filter((ps) => ps.costPrice > 0)
    .sort((a, b) => a.costPrice - b.costPrice)

  if (validSuppliers.length > 0) {
    return {
      costPrice: validSuppliers[0].costPrice,
      supplierId: validSuppliers[0].supplierId,
      supplierName: validSuppliers[0].supplier?.name,
    }
  }
  if (product.costPrice && product.costPrice > 0) {
    return {
      costPrice: product.costPrice,
      supplierId: product.supplierId || undefined,
    }
  }
  return null
}

function getLastClientQuotedSp(
  product: Product,
  selectedClientId: string,
  currentQuotationId?: string
): ProductQuotationHistoryItem | null {
  if (!selectedClientId || !product.quotationItems) return null
  const matches = product.quotationItems.filter(
    (qi) => qi.quotation?.clientId === selectedClientId && qi.spSnapshot > 0
  )
  if (matches.length === 0) return null
  const otherQuotationMatch = matches.find(
    (qi) => !currentQuotationId || qi.quotation?.id !== currentQuotationId
  )
  return otherQuotationMatch || matches[0]
}

export function QuotationForm({
  clients: initialClients,
  products,
  initialData,
  initialUpdatedAt,
}: {
  clients: Client[]
  products: Product[]
  initialData?: any
  initialUpdatedAt?: Date
}) {
  const router = useRouter()

  // Base states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quotationId, setQuotationId] = useState(initialData?.id || "")
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE")
  const [conflictDetected, setConflictDetected] = useState(false)
  const [saveSellingPricesToCatalog, setSaveSellingPricesToCatalog] = useState(true)
  const expectedUpdatedAt = useRef<Date | undefined>(initialUpdatedAt)

  // Form fields
  const [clients, setClients] = useState(initialClients)
  const [selectedClientId, setSelectedClientId] = useState(initialData?.clientId || "")
  const [prNo, setPrNo] = useState(initialData?.prNo || "")
  const [rfqNo, setRfqNo] = useState(initialData?.rfqNo || "")
  const [items, setItems] = useState<QuotationLineItem[]>(() =>
    (initialData?.items || []).map((item: any, idx: number) => {
      const catalogMatch = products.find((p) => p.id === item.product?.id)
      const enrichedProduct: Product = {
        ...item.product,
        materialDescription:
          item.itemDescription || item.product?.materialDescription || "",
        specification:
          item.itemSpecification ?? item.product?.specification ?? null,
        unit: item.itemUnit || item.product?.unit || "NOS",
        productSuppliers:
          item.product?.productSuppliers || catalogMatch?.productSuppliers || [],
        quotationItems:
          item.product?.quotationItems || catalogMatch?.quotationItems || [],
      }
      const lowest = getLowestVendorForProduct(enrichedProduct)
      const matchedVendor = (enrichedProduct.productSuppliers || []).find(
        (ps) => ps.supplierId === item.supplierId
      )

      return {
        lineId: item.id || `init-line-${idx + 1}`,
        product: enrichedProduct,
        quantity: item.quantity,
        quotedQuantity: item.quotedQuantity ?? item.quantity,
        isConfirmed: item.isConfirmed !== false,
        itemsNo: item.itemsNo || undefined,
        cpSnapshot: item.cpSnapshot || lowest?.costPrice || undefined,
        commissionCpSnapshot: item.commissionCpSnapshot || undefined,
        spSnapshot: item.spSnapshot || 0,
        supplierId: item.supplierId || lowest?.supplierId || undefined,
        supplierName:
          item.supplier?.name || matchedVendor?.supplier?.name || lowest?.supplierName,
        comment: item.comment || undefined,
        leadTime: item.leadTime || undefined,
        additionalCost: item.additionalCost || 0,
      }
    })
  )

  // Active Item Quick-Pricing Dock (keyed by unique lineId so duplicate products work independently)
  const [activeLineId, setActiveLineId] = useState<string | null>(() =>
    initialData?.items?.[0] ? initialData.items[0].id || "init-line-1" : null
  )
  const activeQtyInputRef = useRef<HTMLInputElement>(null)
  const activeDescInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Table Filtering, Sorting & Spec Expansion
  const [itemFilter, setItemFilter] = useState<"ALL" | "PENDING">("ALL")
  const [newestFirst, setNewestFirst] = useState<boolean>(false)
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set())
  const [bulkMarkupPct, setBulkMarkupPct] = useState<string>("20")
  const [bulkLeadTime, setBulkLeadTime] = useState<string>("Ex-Stock")
  const [bulkGstRate, setBulkGstRate] = useState<number>(18)
  const [isCreatingMissingCpRfq, setIsCreatingMissingCpRfq] = useState<boolean>(false)

  const toggleSpecDrawer = (lineId: string) => {
    setExpandedSpecs((prev) => {
      const n = new Set(prev)
      if (n.has(lineId)) n.delete(lineId)
      else n.add(lineId)
      return n
    })
  }

  // Client Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newClientContact, setNewClientContact] = useState("")
  const [newClientGst, setNewClientGst] = useState("")
  const [newClientLocation, setNewClientLocation] = useState("")
  const [newClientAddress, setNewClientAddress] = useState("")
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [isVerifyingGST, setIsVerifyingGST] = useState(false)

  // Autocomplete
  const [searchTerm, setSearchTerm] = useState("")
  const [quickUom, setQuickUom] = useState("NOS")
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  // Excel Upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Vendor Pricing Dialog (tracks lineId so only that specific row is updated)
  const [vendorDialogItem, setVendorDialogItem] = useState<{
    lineId: string
    productId: string
    productName: string
    currentCp?: number
    currentSp?: number
  } | null>(null)

  // Floating Top-Center Interactive Toast Prompt for Untagged Vendor CP
  const [knownSuppliers, setKnownSuppliers] = useState<{ id: string; name: string }[]>(() => {
    const map = new Map<string, { id: string; name: string }>()
    products.forEach((p) => {
      ;(p.productSuppliers || []).forEach((ps) => {
        if (ps.supplier?.id && ps.supplier?.name) {
          map.set(ps.supplier.id, { id: ps.supplier.id, name: ps.supplier.name })
        }
      })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  })
  const [untaggedVendorToast, setUntaggedVendorToast] = useState<{
    lineId: string
    productId: string
    materialCode: string
    cpPaise: number
  } | null>(null)
  const [untaggedVendorInput, setUntaggedVendorInput] = useState("")
  const [isSavingUntaggedVendor, setIsSavingUntaggedVendor] = useState(false)
  const untaggedCpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const untaggedVendorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchSuppliers("").then((res) => {
      if (res.data && res.data.length > 0) {
        setKnownSuppliers((prev) => {
          const map = new Map<string, { id: string; name: string }>()
          prev.forEach((s) => map.set(s.id, s))
          res.data.forEach((s: any) => {
            if (s.id && s.name) map.set(s.id, { id: s.id, name: s.name })
          })
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
        })
      }
    })
    return () => {
      if (untaggedCpTimerRef.current) clearTimeout(untaggedCpTimerRef.current)
    }
  }, [])

  const openUntaggedVendorToast = (item: QuotationLineItem, focusImmediately = false) => {
    if (!item.cpSnapshot || item.cpSnapshot <= 0) return
    setUntaggedVendorToast({
      lineId: item.lineId,
      productId: item.product.id,
      materialCode: item.product.materialCode,
      cpPaise: item.cpSnapshot,
    })
    setUntaggedVendorInput("")
    if (focusImmediately) {
      setTimeout(() => {
        untaggedVendorInputRef.current?.focus()
      }, 40)
    }
  }

  const handleSaveUntaggedVendor = async () => {
    if (!untaggedVendorToast || !untaggedVendorInput.trim()) return
    setIsSavingUntaggedVendor(true)
    try {
      const cpInRupees = untaggedVendorToast.cpPaise / 100
      const res = await addProductSupplier(
        untaggedVendorToast.productId,
        untaggedVendorInput.trim(),
        cpInRupees
      )
      if (res.success && res.data) {
        const saved = res.data
        const supplierObj = {
          id: saved.supplierId,
          name: saved.supplier?.name || untaggedVendorInput.trim(),
        }
        setKnownSuppliers((prev) => {
          const map = new Map<string, { id: string; name: string }>()
          prev.forEach((s) => map.set(s.id, s))
          map.set(supplierObj.id, supplierObj)
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
        })
        setItems((prev) =>
          prev.map((item) => {
            const isTargetLine = item.lineId === untaggedVendorToast.lineId
            const isSameProduct = item.product.id === untaggedVendorToast.productId
            if (!isTargetLine && !isSameProduct) return item

            const existingPs = item.product.productSuppliers || []
            const filteredPs = existingPs.filter((ps) => ps.supplierId !== saved.supplierId)
            const nextPs: ProductSupplierRate[] = [
              ...filteredPs,
              {
                id: saved.id,
                supplierId: saved.supplierId,
                costPrice: saved.costPrice,
                supplier: supplierObj,
              },
            ].sort((a, b) => a.costPrice - b.costPrice)

            return {
              ...item,
              ...(isTargetLine ||
              (!item.supplierId && item.cpSnapshot === saved.costPrice)
                ? {
                    supplierId: saved.supplierId,
                    supplierName: supplierObj.name,
                    cpSnapshot: saved.costPrice,
                  }
                : {}),
              product: {
                ...item.product,
                productSuppliers: nextPs,
              },
            }
          })
        )
        sileo.success({
          title: "Vendor Tagged to Cost Price",
          description: `Tagged "${supplierObj.name}" for CP ${formatRupee(saved.costPrice)} on ${untaggedVendorToast.materialCode}.`,
        })
        setUntaggedVendorToast(null)
        setUntaggedVendorInput("")
      } else {
        sileo.error({
          title: "Failed to Tag Vendor",
          description: res.error || "Could not save vendor for this cost price.",
        })
      }
    } catch {
      sileo.error({
        title: "Failed to Tag Vendor",
        description: "An unexpected error occurred while saving vendor.",
      })
    } finally {
      setIsSavingUntaggedVendor(false)
    }
  }

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
      } catch {
        // ignore polling errors
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [quotationId, conflictDetected])

  const handleVerifyGST = async () => {
    if (!newClientGst.trim() || newClientGst.length < 15) {
      sileo.warning({
        title: "Invalid GSTIN",
        description: "Please enter a valid 15-character GST Number.",
      })
      return
    }
    setIsVerifyingGST(true)
    try {
      const res = await verifyGSTAction(newClientGst.trim())
      if (res.error) {
        sileo.error({
          title: "GST Verification Failed",
          description: res.error,
        })
      } else if (res.data) {
        setNewClientName(res.data.name || newClientName)
        setNewClientLocation(res.data.location || newClientLocation)
        setNewClientAddress(res.data.address || newClientAddress)
        sileo.success({
          title: "GSTIN Verified",
          description: `Fetched details for ${res.data.name || res.data.legalName}.`,
        })
      }
    } catch {
      sileo.error({
        title: "GST Verification Failed",
        description: "Could not verify GST number at this time.",
      })
    } finally {
      setIsVerifyingGST(false)
    }
  }

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return
    setIsCreatingClient(true)
    try {
      const res = await createClient({
        name: newClientName,
        contact: newClientContact,
        gstNumber: newClientGst,
        location: newClientLocation,
        address: newClientAddress,
      })
      if (res.success && res.client) {
        setClients((prev) => [...prev, res.client].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedClientId(res.client.id)
        setIsClientModalOpen(false)
        setNewClientName("")
        setNewClientContact("")
        setNewClientGst("")
        setNewClientLocation("")
        setNewClientAddress("")
        sileo.success({
          title: "Client Created",
          description: `${res.client.name} has been added and selected.`,
        })
      } else {
        sileo.error({
          title: "Failed to Create Client",
          description: res.error || "Could not create client.",
        })
      }
    } catch {
      sileo.error({
        title: "Failed to Create Client",
        description: "An unexpected error occurred.",
      })
    } finally {
      setIsCreatingClient(false)
    }
  }

  // Autocomplete Logic
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
        addProductToQuotation(filteredProducts[highlightedIndex])
      } else if (searchTerm.trim() !== "") {
        handleQuickCreateFromSearch()
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false)
    }
  }

  const handleQuickCreateFromSearch = async () => {
    if (!searchTerm.trim()) return

    const existing = products.find(
      (p) => p.materialDescription.toLowerCase() === searchTerm.toLowerCase()
    )
    if (existing) {
      addProductToQuotation(existing)
      return
    }

    try {
      const res = await createQuickProduct({
        materialCode: "RAD-" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        materialDescription: searchTerm.trim(),
        unit: quickUom.trim().toUpperCase() || "NOS",
        gstRate: 18,
      })
      if (res.success && res.product) {
        addProductToQuotation(res.product)
        sileo.success({
          title: "Quick Product Created",
          description: `Added "${res.product.materialDescription}" and opened in Quick-Price Dock.`,
        })
      } else {
        sileo.error({
          title: "Failed to Create Product",
          description: res.error || "Could not create product.",
        })
      }
    } catch {
      sileo.error({
        title: "Failed to Create Product",
        description: "Could not create product automatically.",
      })
    }
  }

  const addProductToQuotation = (product: Product, quantity = 1, itemsNo?: string) => {
    const existingCount = items.filter((i) => i.product.id === product.id).length
    const lowestVendor = getLowestVendorForProduct(product)
    const newLineId = createLineId()

    const newItem: QuotationLineItem = {
      lineId: newLineId,
      product: { ...product },
      quantity,
      quotedQuantity: quantity,
      isConfirmed: true,
      itemsNo,
      cpSnapshot: lowestVendor ? lowestVendor.costPrice : undefined,
      supplierId: lowestVendor?.supplierId,
      supplierName: lowestVendor?.supplierName,
      commissionCpSnapshot: product.commissionCostPrice || undefined,
      spSnapshot: product.sellingPrice && product.sellingPrice > 0 ? product.sellingPrice : 0,
      leadTime: "2-3 Weeks",
    }

    setItems((prev) => [...prev, newItem])
    setActiveLineId(newLineId)
    setSearchTerm("")
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)

    if (
      newItem.cpSnapshot &&
      newItem.cpSnapshot > 0 &&
      !newItem.supplierId &&
      !newItem.supplierName
    ) {
      openUntaggedVendorToast(newItem, false)
    }

    if (existingCount > 0) {
      sileo.info({
        title: `Added Variant #${existingCount + 1} for ${product.materialCode}`,
        description:
          "You can edit its Description (e.g. Size A / Size B), Quantity, CP & SP independently.",
      })
      setTimeout(() => {
        activeDescInputRef.current?.focus()
        activeDescInputRef.current?.select()
      }, 60)
    } else {
      setTimeout(() => {
        activeQtyInputRef.current?.focus()
        activeQtyInputRef.current?.select()
      }, 60)
    }
  }

  const handleDuplicateVariantRow = (sourceLineId: string) => {
    const idx = items.findIndex((i) => i.lineId === sourceLineId)
    if (idx < 0) return
    const source = items[idx]
    const newLineId = createLineId()
    const duplicatedItem: QuotationLineItem = {
      ...source,
      lineId: newLineId,
      product: { ...source.product },
    }

    setItems((prev) => {
      const next = [...prev]
      next.splice(idx + 1, 0, duplicatedItem)
      return next
    })
    setActiveLineId(newLineId)

    sileo.info({
      title: "Variant Row Added",
      description: `Duplicated "${source.product.materialDescription}" — edit its Size / Variant description in the top dock.`,
    })

    setTimeout(() => {
      activeDescInputRef.current?.focus()
      activeDescInputRef.current?.select()
    }, 60)
  }

  const handleRemoveItem = (lineId: string) => {
    setItems((prev) => {
      const remaining = prev.filter((i) => i.lineId !== lineId)
      if (activeLineId === lineId) {
        setActiveLineId(remaining.length > 0 ? remaining[remaining.length - 1].lineId : null)
      }
      return remaining
    })
    if (untaggedVendorToast?.lineId === lineId) {
      setUntaggedVendorToast(null)
    }
  }

  const updateLineItem = (
    lineId: string,
    updater: (item: QuotationLineItem) => QuotationLineItem
  ) => {
    setItems((prev) => prev.map((item) => (item.lineId === lineId ? updater(item) : item)))
  }

  const handleQuantityChange = (lineId: string, quantity: number) => {
    updateLineItem(lineId, (item) => ({ ...item, quantity }))
  }

  const handleCpChange = (lineId: string, cpPaise: number | undefined) => {
    if (untaggedCpTimerRef.current) {
      clearTimeout(untaggedCpTimerRef.current)
      untaggedCpTimerRef.current = null
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.lineId !== lineId) return item
        if (!cpPaise || cpPaise <= 0) {
          if (untaggedVendorToast?.lineId === lineId) {
            setUntaggedVendorToast(null)
          }
          return {
            ...item,
            cpSnapshot: undefined,
            supplierId: undefined,
            supplierName: undefined,
          }
        }
        const matchedVendor = (item.product.productSuppliers || []).find(
          (ps) => ps.costPrice === cpPaise && (ps.supplier?.name || ps.supplierId)
        )
        if (matchedVendor) {
          if (untaggedVendorToast?.lineId === lineId) {
            setUntaggedVendorToast(null)
          }
          return {
            ...item,
            cpSnapshot: cpPaise,
            supplierId: matchedVendor.supplierId,
            supplierName: matchedVendor.supplier?.name || item.supplierName,
          }
        }
        untaggedCpTimerRef.current = setTimeout(() => {
          setUntaggedVendorToast({
            lineId: item.lineId,
            productId: item.product.id,
            materialCode: item.product.materialCode,
            cpPaise,
          })
        }, 650)
        return {
          ...item,
          cpSnapshot: cpPaise,
          supplierId: undefined,
          supplierName: undefined,
        }
      })
    )
  }

  /**
   * Whenever Selling Price (SP) is applied/entered for an item,
   * automatically select the vendor with the lowest cost price (CP) if the product has vendor rates.
   */
  const handleSpChange = (lineId: string, spPaise: number) => {
    updateLineItem(lineId, (item) => {
      if (spPaise > 0) {
        const lowest = getLowestVendorForProduct(item.product)
        if (lowest) {
          return {
            ...item,
            spSnapshot: spPaise,
            cpSnapshot: lowest.costPrice,
            supplierId: lowest.supplierId || item.supplierId,
            supplierName: lowest.supplierName || item.supplierName,
          }
        }
      }
      return { ...item, spSnapshot: spPaise }
    })
  }

  const handleCommentChange = (lineId: string, comment: string) => {
    updateLineItem(lineId, (item) => ({ ...item, comment }))
  }

  const handleLeadTimeChange = (lineId: string, leadTime: string) => {
    updateLineItem(lineId, (item) => ({ ...item, leadTime }))
  }

  const handleCommissionCpChange = (lineId: string, value: number) => {
    updateLineItem(lineId, (item) => ({ ...item, commissionCpSnapshot: value }))
  }

  const handleAdditionalCostChange = (lineId: string, value: number) => {
    updateLineItem(lineId, (item) => ({ ...item, additionalCost: value }))
  }

  const handleProductChange = (
    lineId: string,
    field: "materialCode" | "materialDescription" | "unit" | "gstRate" | "specification",
    value: any
  ) => {
    updateLineItem(lineId, (item) => ({
      ...item,
      product: { ...item.product, [field]: value },
    }))
  }

  const handleSaveItemSpToCatalog = async (
    productId: string,
    productName: string,
    spPaise?: number,
    cpPaise?: number
  ) => {
    if (!spPaise || spPaise <= 0) {
      sileo.warning({
        title: "Enter Selling Price First",
        description: "Please enter a Selling Price (SP) greater than ₹0 before saving to history.",
      })
      return
    }
    const res = await saveProductSellingPrice(productId, spPaise, cpPaise)
    if (res.success) {
      sileo.success({
        title: "Selling Price Saved to Catalog",
        description: `${formatRupee(spPaise)} saved to ${productName} and logged in Price History.`,
      })
    } else {
      sileo.error({
        title: "Failed to Save Selling Price",
        description: res.error || "Could not save selling price.",
      })
    }
  }

  const handleVendorPriceSave = (
    cp: number,
    sp: number,
    supplierId: string,
    supplierName?: string
  ) => {
    if (!vendorDialogItem) return
    updateLineItem(vendorDialogItem.lineId, (item) => ({
      ...item,
      cpSnapshot: cp,
      spSnapshot: sp,
      supplierId: supplierId || item.supplierId,
      supplierName: supplierName || item.supplierName,
    }))
    setVendorDialogItem(null)
  }

  // Row Reordering
  const handleMoveRow = (index: number, direction: "UP" | "DOWN") => {
    const targetIndex = direction === "UP" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  // Bulk Tools
  const applyDefaultLeadTime = (preset?: string) => {
    const targetLT =
      (preset ?? bulkLeadTime).trim() ||
      items.find((i) => i.leadTime?.trim())?.leadTime ||
      "Ex-Stock"
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        leadTime: targetLT,
      }))
    )
    sileo.success({
      title: "Lead Time Applied to All Rows",
      description: `Set lead time "${targetLT}" across all ${items.length} line item(s).`,
    })
  }

  const applyBulkGstToAll = (rateOverride?: number) => {
    const targetGst = rateOverride !== undefined ? rateOverride : bulkGstRate
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        product: {
          ...item.product,
          gstRate: targetGst,
        },
      }))
    )
    sileo.success({
      title: `Applied ${targetGst}% GST to All`,
      description: `Updated GST rate to ${targetGst}% across all ${items.length} line item(s).`,
    })
  }

  const autoFillLowestVendorCpForAll = () => {
    let filledCount = 0
    setItems((prev) =>
      prev.map((item) => {
        if (item.cpSnapshot && item.cpSnapshot > 0) return item
        const lowest = getLowestVendorForProduct(item.product)
        if (!lowest || lowest.costPrice <= 0) return item
        filledCount++
        return {
          ...item,
          cpSnapshot: lowest.costPrice,
          supplierId: lowest.supplierId || item.supplierId,
          supplierName: lowest.supplierName || item.supplierName,
        }
      })
    )
    if (filledCount > 0) {
      sileo.success({
        title: "Auto-Filled Lowest Vendor CP",
        description: `Applied lowest vendor cost price to ${filledCount} row(s) that had ₹0 CP.`,
      })
    } else {
      sileo.info({
        title: "No Missing CPs Updated",
        description: "All items with available vendor rates already have a Cost Price (CP) set.",
      })
    }
  }

  const handleCreateRfqForMissingCp = async () => {
    const missingCpItems = items.filter((i) => !i.cpSnapshot || i.cpSnapshot <= 0)
    if (missingCpItems.length === 0) return
    setIsCreatingMissingCpRfq(true)
    try {
      const res = await upsertDraftRfq({
        isPublic: true,
        status: "DRAFT",
        items: missingCpItems.map((i) => ({
          product: {
            id: i.product.id,
            materialCode: i.product.materialCode,
            materialDescription: i.product.materialDescription,
            unit: i.product.unit || "NOS",
            gstRate: i.product.gstRate ?? 18,
          },
          quantity: i.quantity || 1,
          comment: i.comment || i.product.specification || undefined,
        })),
      })
      if (res.success && res.id) {
        sileo.success({
          title: "Draft Vendor RFQ Created",
          description: `Created RFQ #${res.id.toUpperCase()} for ${missingCpItems.length} missing-CP item(s). Opening in new tab...`,
        })
        window.open(`/rfq/${res.id}/edit`, "_blank", "noopener,noreferrer")
      } else {
        sileo.error({
          title: "Failed to Create RFQ",
          description: res.error || "Could not create draft RFQ for missing CP items.",
        })
      }
    } catch {
      sileo.error({
        title: "Failed to Create RFQ",
        description: "An unexpected error occurred while creating the RFQ.",
      })
    } finally {
      setIsCreatingMissingCpRfq(false)
    }
  }

  const applyBulkMarkup = (onlyMissingSp: boolean) => {
    const pct = parseFloat(bulkMarkupPct)
    if (isNaN(pct) || pct < 0) {
      sileo.warning({
        title: "Invalid Markup %",
        description: "Please enter a valid markup percentage.",
      })
      return
    }

    let updatedCount = 0
    setItems((prev) =>
      prev.map((item) => {
        const lowest = getLowestVendorForProduct(item.product)
        const baseCp = lowest ? lowest.costPrice : item.cpSnapshot
        if (!baseCp || baseCp <= 0) return item
        if (onlyMissingSp && item.spSnapshot && item.spSnapshot > 0) return item
        const newSpPaise = Math.round(baseCp * (1 + pct / 100))
        updatedCount++
        return {
          ...item,
          cpSnapshot: baseCp,
          supplierId: lowest?.supplierId || item.supplierId,
          supplierName: lowest?.supplierName || item.supplierName,
          spSnapshot: newSpPaise,
        }
      })
    )

    if (updatedCount > 0) {
      sileo.success({
        title: `Applied +${pct}% Markup on Lowest Vendor CP`,
        description: `Calculated Selling Price (SP) using the lowest vendor CP for ${updatedCount} item(s).`,
      })
    } else {
      sileo.warning({
        title: "No Items Updated",
        description: "Ensure items have a Vendor Cost Price (CP) entered first.",
      })
    }
  }

  // Excel Upload
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await parseQuotationExcelAction(formData)

      if (result.success && result.parsedItems) {
        let firstAddedLineId: string | null = null
        setItems((prev) => {
          const newItems = [...prev]
          result.parsedItems.forEach((parsed: any) => {
            const lineId = createLineId()
            if (!firstAddedLineId) firstAddedLineId = lineId
            const catalogMatch = products.find(
              (p) =>
                p.id === parsed.product.id ||
                p.materialCode.toLowerCase() === parsed.product.materialCode?.toLowerCase()
            )
            const enrichedProduct: Product = {
              ...parsed.product,
              id: catalogMatch?.id || parsed.product.id,
              productSuppliers: catalogMatch?.productSuppliers || [],
              quotationItems: catalogMatch?.quotationItems || [],
            }
            const lowest = getLowestVendorForProduct(enrichedProduct)
            newItems.push({
              lineId,
              product: enrichedProduct,
              quantity: parsed.quantity,
              quotedQuantity: parsed.quantity,
              isConfirmed: true,
              itemsNo: parsed.itemsNo,
              cpSnapshot: lowest ? lowest.costPrice : parsed.product.costPrice || undefined,
              supplierId: lowest?.supplierId,
              supplierName: lowest?.supplierName,
              spSnapshot: parsed.product.sellingPrice || catalogMatch?.sellingPrice || 0,
              leadTime: "2-3 Weeks",
            })
          })
          return newItems
        })

        if (firstAddedLineId) setActiveLineId(firstAddedLineId)

        const firstItemWithPr = result.parsedItems.find((p: any) => p.prNo)
        if (firstItemWithPr && !prNo) {
          setPrNo(firstItemWithPr.prNo)
        }
        sileo.success({
          title: "Excel Items Imported",
          description: `Imported ${result.parsedItems.length} line item(s) into quotation.`,
        })
      } else {
        sileo.error({
          title: "Excel Import Failed",
          description: result.error || "Failed to parse Excel file.",
        })
      }
    } catch {
      sileo.error({
        title: "Excel Import Error",
        description: "Error uploading or parsing Excel file.",
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Final Submit
  const handleSubmit = async (status: string) => {
    if (!selectedClientId) {
      sileo.warning({
        title: "Client Required",
        description: "Please select a client before saving the quotation.",
      })
      return
    }
    if (items.length === 0) {
      sileo.warning({
        title: "Line Items Required",
        description: "Please add at least one product item to the quotation.",
      })
      return
    }

    setIsSubmitting(true)
    setSaveStatus("SAVING")
    try {
      const payload = {
        id: quotationId || undefined,
        clientId: selectedClientId,
        prNo,
        rfqNo,
        status,
        saveSellingPricesToCatalog,
        expectedUpdatedAt: expectedUpdatedAt.current,
        items: items.map((item) => {
          const lowest = getLowestVendorForProduct(item.product)
          return {
            product: item.product,
            quantity: item.quantity,
            quotedQuantity: item.quotedQuantity ?? item.quantity,
            isConfirmed: item.isConfirmed !== false,
            spSnapshot: item.spSnapshot ?? 0,
            cpSnapshot: item.cpSnapshot ?? lowest?.costPrice,
            commissionCpSnapshot: item.commissionCpSnapshot,
            supplierId: item.supplierId ?? lowest?.supplierId,
            comment: item.comment,
            leadTime: item.leadTime,
            additionalCost: item.additionalCost || 0,
          }
        }),
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
          window.history.replaceState(null, "", `/quotations/${result.id}/edit`)
        }

        if (result.id) {
          const updatedRes = await getQuotationUpdatedAt(result.id)
          if (updatedRes.success && updatedRes.updatedAt) {
            expectedUpdatedAt.current = new Date(updatedRes.updatedAt)
          }
        }

        sileo.success({
          title: "Quotation Draft Saved",
          description: saveSellingPricesToCatalog
            ? "Draft saved and selling prices synced to product catalog & history."
            : "Quotation draft has been saved.",
        })

        router.refresh()
        setTimeout(() => setSaveStatus("IDLE"), 2000)
      } else {
        sileo.success({
          title: quotationId ? "Quotation Updated" : "Quotation Created",
          description: `Quotation #${(result.id || "").toUpperCase()} has been finalized.`,
        })
        router.push(`/quotations/${result.id}`)
        router.refresh()
      }
    } catch (error: any) {
      console.error(error)
      sileo.error({
        title: "Failed to Save Quotation",
        description: error.message || "Something went wrong while saving.",
      })
      setSaveStatus("ERROR")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Active item in the Quick-Pricing Dock
  const activeItemIndex = items.findIndex((i) => i.lineId === activeLineId)
  const activeItem = activeItemIndex >= 0 ? items[activeItemIndex] : null
  const activeLowestVendor = activeItem ? getLowestVendorForProduct(activeItem.product) : null
  const activeLastClientQuote = activeItem
    ? getLastClientQuotedSp(activeItem.product, selectedClientId, quotationId)
    : null

  const handleDockKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault()
      if (activeItemIndex >= 0 && activeItemIndex < items.length - 1) {
        setActiveLineId(items[activeItemIndex + 1].lineId)
      }
    } else if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault()
      if (activeItemIndex > 0) {
        setActiveLineId(items[activeItemIndex - 1].lineId)
      }
    }
  }

  // Filtered & sorted items for table display
  const indexedItems = items.map((item, idx) => ({ item, originalIndex: idx }))
  const filteredIndexedItems = indexedItems.filter(({ item }) => {
    if (itemFilter === "PENDING") {
      return !item.cpSnapshot || !item.spSnapshot || item.spSnapshot <= 0
    }
    return true
  })
  const displayedItems = newestFirst
    ? [...filteredIndexedItems].reverse()
    : filteredIndexedItems

  const pendingPriceCount = items.filter(
    (i) => !i.cpSnapshot || !i.spSnapshot || i.spSnapshot <= 0
  ).length
  const unpricedCpCount = items.filter((i) => !i.cpSnapshot || i.cpSnapshot <= 0).length

  return (
    <div className="space-y-5">
      <datalist id="quotation-suppliers-datalist">
        {knownSuppliers.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>

      {/* Top-Center Interactive Toast Prompt for Untagged Vendor CP */}
      {untaggedVendorToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[110] bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-[95vw] flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-amber-300">
                No Vendor Tagged for CP {formatRupee(untaggedVendorToast.cpPaise)}
              </span>{" "}
              <span className="font-mono text-[11px] text-slate-300">
                ({untaggedVendorToast.materialCode})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={untaggedVendorInputRef}
              type="text"
              list="quotation-suppliers-datalist"
              value={untaggedVendorInput}
              onChange={(e) => setUntaggedVendorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSaveUntaggedVendor()
                } else if (e.key === "Escape") {
                  setUntaggedVendorToast(null)
                }
              }}
              placeholder="Enter or pick vendor name..."
              className="bg-slate-800 border border-slate-600 focus:border-orange-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none w-52"
            />
            <button
              type="button"
              onClick={handleSaveUntaggedVendor}
              disabled={isSavingUntaggedVendor || !untaggedVendorInput.trim()}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              {isSavingUntaggedVendor ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Check className="w-3.5 h-3.5 text-white" />
              )}
              <span>Save Vendor</span>
            </button>
            <button
              type="button"
              onClick={() => setUntaggedVendorToast(null)}
              className="p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-rose-800">
              Conflict Detected: Newer Version Available
            </h3>
            <p className="text-xs text-rose-700 mt-1">
              Another user has modified this quotation since you opened it. Reload to view their changes.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Reload Latest Version
            </button>
          </div>
        </div>
      )}

      {/* Client Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add New Client</h3>
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
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
                    value={newClientGst}
                    onChange={(e) => setNewClientGst(e.target.value)}
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
                  Client Organization Name *
                </label>
                <input
                  autoFocus
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                  placeholder="Acme Industries Pvt Ltd"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Location / City
                </label>
                <input
                  value={newClientLocation}
                  onChange={(e) => setNewClientLocation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                  placeholder="Hyderabad, Telangana"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Full Address
                </label>
                <textarea
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                  placeholder="Billing & delivery address"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Contact (Email / Phone)
                </label>
                <input
                  value={newClientContact}
                  onChange={(e) => setNewClientContact(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                  placeholder="procurement@acme.com"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateClient}
                disabled={isCreatingClient || !newClientName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors mt-2 cursor-pointer"
              >
                {isCreatingClient ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  "Create Client"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Header Metadata Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Client Organization *
            </label>
            <div className="flex gap-2">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              >
                <option value="">Select a Client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsClientModalOpen(true)}
                className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                title="Add New Client"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Client PR No
            </label>
            <input
              value={prNo}
              onChange={(e) => setPrNo(e.target.value)}
              type="text"
              placeholder="e.g. PR-2026-019"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Client RFQ Reference
            </label>
            <input
              value={rfqNo}
              onChange={(e) => setRfqNo(e.target.value)}
              type="text"
              placeholder="e.g. RFQ-8821"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>
        </div>
      </div>

      {/* 2. Product Search & Quick-Add Bar + Instant Active Item Pricing Dock */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>Add & Price Products</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                Multi-Variant & Custom Size Descriptions Enabled
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Calculator className="w-3 h-3" /> Smart Math & Auto Lowest Vendor CP
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add the same product multiple times for different sizes/variants (e.g., Size A & Size B) — each line keeps its own description, Qty, CP & SP.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold rounded-lg transition-colors text-xs border border-slate-300 shadow-2xs cursor-pointer"
            >
              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Import Excel
            </button>
            <button
              type="button"
              onClick={() => setIsProductModalOpen(true)}
              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              New Catalog Product
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative z-[55]" ref={autocompleteRef}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setIsDropdownOpen(true)
                  setHighlightedIndex(-1)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Type material code or description to add (you can add the same product multiple times for different sizes)..."
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <input
              type="text"
              value={quickUom}
              onChange={(e) => setQuickUom(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="UOM"
              className="w-20 bg-slate-50 focus:bg-white border border-slate-300 rounded-lg px-2.5 py-2.5 text-slate-900 font-mono text-xs font-semibold focus:outline-none focus:border-orange-600 uppercase text-center"
              title="Default UOM when quick-creating via Enter"
            />
          </div>

          <ProductModal
            forceOpen={isProductModalOpen}
            onForceClose={() => setIsProductModalOpen(false)}
            onSuccess={(p) => {
              addProductToQuotation(p)
              setIsProductModalOpen(false)
            }}
          />

          {isDropdownOpen && searchTerm && (
            <ul className="absolute z-[60] mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <li
                  onClick={handleQuickCreateFromSearch}
                  className="px-4 py-3 text-slate-700 hover:bg-orange-50 cursor-pointer text-xs flex items-center justify-between"
                >
                  <span>
                    No exact catalog match. Press <strong>Enter</strong> or click here to quick-create{" "}
                    <strong>&ldquo;{searchTerm}&rdquo;</strong> ({quickUom})
                  </span>
                  <span className="text-orange-600 font-bold">+ Quick Create & Price</span>
                </li>
              ) : (
                filteredProducts.map((p, idx) => {
                  const countInQuote = items.filter((i) => i.product.id === p.id).length
                  const lowest = getLowestVendorForProduct(p)
                  return (
                    <li
                      key={p.id}
                      onClick={() => addProductToQuotation(p)}
                      className={`px-4 py-2.5 cursor-pointer hover:bg-orange-50/70 transition-colors flex items-center justify-between gap-4 ${
                        highlightedIndex === idx ? "bg-orange-50" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold font-mono text-slate-900">
                            {p.materialCode}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {p.unit}
                          </span>
                          {countInQuote > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              In Quote ({countInQuote}) — Click to Add Another Size / Variant
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-700 font-medium truncate mt-0.5">
                          {p.materialDescription}
                        </div>
                        {p.specification && (
                          <div className="text-[11px] text-slate-400 truncate">
                            {p.specification}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 text-xs font-mono">
                        {p.sellingPrice > 0 ? (
                          <div className="text-emerald-700 font-bold">
                            SP: {formatRupee(p.sellingPrice)}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[11px]">No SP</div>
                        )}
                        {lowest ? (
                          <div className="text-amber-700 text-[11px]">
                            Lowest CP: {formatRupee(lowest.costPrice)}
                            {lowest.supplierName ? ` (${lowest.supplierName})` : ""}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </div>

        {/* ── ACTIVE ITEM QUICK-PRICING DOCK (Right Below Search Bar!) ── */}
        {activeItem && (
          <div
            onKeyDown={handleDockKeyDown}
            className="bg-gradient-to-br from-orange-50/80 via-white to-amber-50/40 border-2 border-orange-300 rounded-xl p-4 shadow-sm transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-orange-200/70">
              <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white text-[11px] font-black font-mono shrink-0">
                  ACTIVE ITEM #{activeItemIndex + 1} of {items.length}
                </span>
                {unpricedCpCount > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold">
                      {unpricedCpCount} Missing CP
                    </span>
                    <button
                      type="button"
                      onClick={handleCreateRfqForMissingCp}
                      disabled={isCreatingMissingCpRfq}
                      className="px-2.5 py-0.5 rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      title="Create a Draft Vendor RFQ with all items missing Cost Price and open in a new tab"
                    >
                      {isCreatingMissingCpRfq ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                      ) : (
                        <Send className="w-3 h-3 text-white" />
                      )}
                      <span>Create RFQ for Missing CP</span>
                    </button>
                  </div>
                )}
                <span className="font-mono text-xs font-bold text-slate-900 shrink-0">
                  {activeItem.product.materialCode}
                </span>
                <input
                  ref={activeDescInputRef}
                  type="text"
                  value={activeItem.product.materialDescription}
                  onChange={(e) =>
                    handleProductChange(
                      activeItem.lineId,
                      "materialDescription",
                      e.target.value
                    )
                  }
                  placeholder="Edit Product Description / Size / Variant..."
                  className="flex-1 min-w-[200px] bg-white border border-orange-300 focus:border-orange-600 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  title="Edit description for this line (e.g. PRODUCT A SIZE A or PRODUCT A SIZE B)"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleDuplicateVariantRow(activeItem.lineId)}
                  className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="Add another row of this same product for a different Size or Variant"
                >
                  <CopyPlus className="w-3.5 h-3.5 text-white" />
                  + Add Variant / Size
                </button>
                <button
                  type="button"
                  disabled={activeItemIndex <= 0}
                  onClick={() =>
                    activeItemIndex > 0 &&
                    setActiveLineId(items[activeItemIndex - 1].lineId)
                  }
                  className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-200 rounded-md flex items-center gap-0.5 cursor-pointer"
                  title="Previous Item in Quotation (Alt + ↑)"
                >
                  ← Prev Item
                </button>
                <button
                  type="button"
                  disabled={activeItemIndex >= items.length - 1}
                  onClick={() =>
                    activeItemIndex < items.length - 1 &&
                    setActiveLineId(items[activeItemIndex + 1].lineId)
                  }
                  className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-200 rounded-md flex items-center gap-0.5 cursor-pointer"
                  title="Next Item in Quotation (Alt + ↓)"
                >
                  Next Item →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    searchInputRef.current?.focus()
                  }}
                  className="px-3 py-1 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-md cursor-pointer shadow-2xs"
                >
                  + Add Next Product
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLineId(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                  title="Minimize Active Item Dock"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-start">
              {/* 1. Qty & UOM (2 cols) */}
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  1. Quantity & UOM
                </label>
                <div className="flex items-center gap-1.5">
                  <SmartNumberInput
                    ref={activeQtyInputRef}
                    value={activeItem.quantity}
                    onValueChange={(val) =>
                      handleQuantityChange(activeItem.lineId, val || 0)
                    }
                    placeholder="Qty (e.g. 10+5)"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                  />
                  <input
                    type="text"
                    value={activeItem.product.unit}
                    onChange={(e) =>
                      handleProductChange(activeItem.lineId, "unit", e.target.value)
                    }
                    className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-xs font-mono font-bold text-slate-700 text-center uppercase focus:outline-none"
                  />
                </div>
              </div>

              {/* 2. Vendor Cost Price CP (3 cols) */}
              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    2. Vendor Cost (CP ₹)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setVendorDialogItem({
                        lineId: activeItem.lineId,
                        productId: activeItem.product.id,
                        productName: activeItem.product.materialDescription,
                        currentCp: activeItem.cpSnapshot,
                        currentSp: activeItem.spSnapshot,
                      })
                    }
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3 h-3" /> Vendors & History
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono z-10 pointer-events-none">
                    ₹
                  </span>
                  <SmartNumberInput
                    value={activeItem.cpSnapshot ? activeItem.cpSnapshot / 100 : ""}
                    onValueChange={(val, rawStr) =>
                      handleCpChange(
                        activeItem.lineId,
                        rawStr === "" ? undefined : Math.round(val * 100)
                      )
                    }
                    placeholder="CP or math (e.g. 450+50)"
                    className="w-full bg-white border border-amber-300 rounded-lg pl-7 pr-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                  />
                </div>
                {activeItem.cpSnapshot &&
                activeItem.cpSnapshot > 0 &&
                !activeItem.supplierId &&
                !activeItem.supplierName ? (
                  <button
                    type="button"
                    onClick={() => openUntaggedVendorToast(activeItem, true)}
                    className="mt-1 w-full text-left text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded px-2 py-0.5 transition-colors cursor-pointer"
                  >
                    ⚠ No Vendor Tagged · Click to Tag Vendor
                  </button>
                ) : activeLowestVendor ? (
                  <div className="mt-1 flex items-center justify-between text-[10px] text-amber-800 bg-amber-50/80 border border-amber-200/80 rounded px-2 py-0.5">
                    <span className="truncate flex items-center gap-1">
                      <Award className="w-3 h-3 text-emerald-600 shrink-0" />
                      {activeItem.supplierName || activeLowestVendor.supplierName
                        ? `Lowest: ${activeItem.supplierName || activeLowestVendor.supplierName}`
                        : "Lowest CP"}
                      : <strong>{formatRupee(activeLowestVendor.costPrice)}</strong>
                    </span>
                    {activeItem.cpSnapshot !== activeLowestVendor.costPrice && (
                      <button
                        type="button"
                        onClick={() =>
                          updateLineItem(activeItem.lineId, (it) => ({
                            ...it,
                            cpSnapshot: activeLowestVendor.costPrice,
                            supplierId: activeLowestVendor.supplierId,
                            supplierName: activeLowestVendor.supplierName,
                          }))
                        }
                        className="font-bold text-emerald-700 underline ml-1 shrink-0 cursor-pointer"
                      >
                        Use Lowest
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              {/* 3. Client Selling Price SP + Markup Chips (4 cols) */}
              <div className="lg:col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    3. Selling Price (SP ₹)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveItemSpToCatalog(
                        activeItem.product.id,
                        activeItem.product.materialDescription,
                        activeItem.spSnapshot,
                        activeItem.cpSnapshot
                      )
                    }
                    className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <BookmarkCheck className="w-3 h-3" /> Save SP to Catalog
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-xs font-mono font-bold z-10 pointer-events-none">
                      ₹
                    </span>
                    <SmartNumberInput
                      value={
                        activeItem.spSnapshot && activeItem.spSnapshot > 0
                          ? activeItem.spSnapshot / 100
                          : ""
                      }
                      onValueChange={(val) =>
                        handleSpChange(activeItem.lineId, Math.round(val * 100))
                      }
                      placeholder="SP or math (e.g. 500+15%)"
                      className="w-full bg-white border border-emerald-400 rounded-lg pl-7 pr-3 py-2 text-sm font-mono font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                </div>
                {activeLastClientQuote && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSpChange(activeItem.lineId, activeLastClientQuote.spSnapshot)
                    }
                    className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
                    title="Click to apply the last Selling Price quoted to this client"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>
                      Last to this client: {formatRupee(activeLastClientQuote.spSnapshot)} (Click to apply)
                    </span>
                  </button>
                )}
                {/* Instant Markup Chips */}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-500 mr-0.5">
                    Markup on Lowest CP:
                  </span>
                  {[10, 15, 20, 25, 30].map((pct) => {
                    const baseCp = activeLowestVendor?.costPrice || activeItem.cpSnapshot || 0
                    return (
                      <button
                        key={pct}
                        type="button"
                        disabled={baseCp <= 0}
                        onClick={() => {
                          if (baseCp <= 0) return
                          const sp = Math.round(baseCp * (1 + pct / 100))
                          handleSpChange(activeItem.lineId, sp)
                        }}
                        className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-white border border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer transition-colors"
                      >
                        +{pct}%
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 4. Lead Time & Live Profit Preview (3 cols) */}
              <div className="lg:col-span-3 space-y-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    4. Delivery Lead Time
                  </label>
                  <input
                    type="text"
                    value={activeItem.leadTime || ""}
                    onChange={(e) =>
                      handleLeadTimeChange(activeItem.lineId, e.target.value)
                    }
                    placeholder="e.g. Ready Stock / 2-3 Weeks"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-orange-600"
                  />
                </div>
                {(() => {
                  const sp = activeItem.spSnapshot || 0
                  const cp = activeItem.cpSnapshot || 0
                  const lineTotal = Math.round(sp * activeItem.quantity)
                  const profit = (sp - cp) * activeItem.quantity - (activeItem.additionalCost || 0)
                  const marginPct = sp > 0 ? ((sp - cp) / sp) * 100 : 0
                  return (
                    <div className="flex items-center justify-between text-xs bg-white/90 px-2.5 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500">
                        Line: <strong className="font-mono text-slate-900">{formatRupee(lineTotal)}</strong>
                      </span>
                      {sp > 0 && cp > 0 ? (
                        <span
                          className={`font-mono font-bold ${
                            profit >= 0 ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          {profit >= 0 ? "+" : ""}
                          {formatRupee(profit)} ({marginPct.toFixed(0)}%)
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-semibold">Set CP & SP</span>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Quick Spec & Remark Row inside Active Dock */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3 pt-2.5 border-t border-orange-200/50">
              <input
                type="text"
                value={activeItem.product.specification || ""}
                onChange={(e) =>
                  handleProductChange(activeItem.lineId, "specification", e.target.value)
                }
                placeholder="Technical Specification (printed below product description)..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-orange-600"
              />
              <input
                type="text"
                value={activeItem.comment || ""}
                onChange={(e) => handleCommentChange(activeItem.lineId, e.target.value)}
                placeholder="Item Remark / Make / Brand Note (optional)..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. High-Density Interactive Pricing Table & Bulk Toolbar */}
      <div className="space-y-3 pb-36">
        {items.length > 0 && (
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Filter Pills & Sort Order */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setItemFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    itemFilter === "ALL"
                      ? "bg-orange-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All Items ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemFilter("PENDING")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    itemFilter === "PENDING"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : pendingPriceCount > 0
                      ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Needs Pricing ({pendingPriceCount})
                </button>

                <button
                  type="button"
                  onClick={() => setNewestFirst(!newestFirst)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                  title="Toggle order so newly added items appear at the top or bottom of the table"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-orange-600" />
                  <span>
                    {newestFirst ? "Showing: Newest Added at Top" : "Showing: Serial Order (#1 → #N)"}
                  </span>
                </button>
              </div>

              {/* Right: Auto-Fill Lowest Vendor CP & Bulk Markup */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={autoFillLowestVendorCpForAll}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Check all rows with ₹0 CP and fill with their lowest vendor Cost Price"
                >
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  Auto-Fill Lowest Vendor CP for All
                </button>

                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600 pl-2 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-orange-600" /> Bulk Markup:
                  </span>
                  <div className="relative w-16">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={bulkMarkupPct}
                      onChange={(e) => setBulkMarkupPct(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-mono font-bold text-slate-900 pr-4"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                      %
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyBulkMarkup(true)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 rounded transition-colors cursor-pointer"
                    title="Apply markup % only to items that have CP but no SP yet"
                  >
                    To Unpriced
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBulkMarkup(false)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors cursor-pointer"
                    title="Recalculate SP for all items using their lowest Vendor CP"
                  >
                    To All w/ CP
                  </button>
                </div>
              </div>
            </div>

            {/* Second Row: Bulk Lead Time & Bulk GST % Action Toolbar */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              {/* Bulk Lead Time */}
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600 pl-2">Bulk Lead Time:</span>
                {["Ex-Stock", "1-2 Weeks", "3-4 Weeks"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBulkLeadTime(preset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      bulkLeadTime === preset
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
                <input
                  type="text"
                  value={bulkLeadTime}
                  onChange={(e) => setBulkLeadTime(e.target.value)}
                  placeholder="Custom lead time..."
                  className="w-28 bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => applyDefaultLeadTime(bulkLeadTime)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors cursor-pointer"
                >
                  Apply to All Rows
                </button>
              </div>

              {/* Bulk GST % */}
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600 pl-2">Bulk GST %:</span>
                {[18, 12, 5, 28].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setBulkGstRate(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                      bulkGstRate === rate
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => applyBulkGstToAll(bulkGstRate)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors cursor-pointer"
                >
                  Apply GST to All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Spreadsheet Table */}
        {items.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No line items added to this quotation yet.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Use the search bar above to add products from your catalog or import an Excel sheet.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 font-bold w-16 text-center">#</th>
                    <th className="py-3 px-3 font-bold min-w-[260px]">
                      Material & Description (Editable per line)
                    </th>
                    <th className="py-3 px-3 font-bold w-28">Qty & UOM</th>
                    <th className="py-3 px-3 font-bold w-48 text-amber-800">
                      Vendor Cost (CP ₹)
                    </th>
                    <th className="py-3 px-3 font-bold w-48 text-emerald-800">
                      Selling Price (SP ₹)
                    </th>
                    <th className="py-3 px-3 font-bold w-32 text-right">Line Total</th>
                    <th className="py-3 px-3 font-bold w-32 text-right">Profit / Margin</th>
                    <th className="py-3 px-3 font-bold w-36">Lead Time</th>
                    <th className="py-3 px-3 font-bold w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayedItems.map(({ item, originalIndex }) => {
                    const sp = item.spSnapshot ?? 0
                    const cp = item.cpSnapshot
                    const lowestVendor = getLowestVendorForProduct(item.product)
                    const lastClientQuote = getLastClientQuotedSp(
                      item.product,
                      selectedClientId,
                      quotationId
                    )
                    const isPending = !cp || !sp || sp <= 0
                    const isFocusedInDock = activeLineId === item.lineId
                    const isSpecOpen = expandedSpecs.has(item.lineId)
                    const lineTotal = Math.round(sp * item.quantity)
                    const lineProfit =
                      (sp - (cp || 0)) * item.quantity - (item.additionalCost || 0)
                    const marginPct = sp > 0 && cp ? ((sp - cp) / sp) * 100 : null

                    return (
                      <FragmentRow
                        key={item.lineId}
                        item={item}
                        originalIndex={originalIndex}
                        totalItems={items.length}
                        sp={sp}
                        cp={cp}
                        lowestVendor={lowestVendor}
                        lastClientQuote={lastClientQuote}
                        isPending={isPending}
                        isFocusedInDock={isFocusedInDock}
                        isSpecOpen={isSpecOpen}
                        lineTotal={lineTotal}
                        lineProfit={lineProfit}
                        marginPct={marginPct}
                        onFocusDock={() => setActiveLineId(item.lineId)}
                        onMoveUp={() => handleMoveRow(originalIndex, "UP")}
                        onMoveDown={() => handleMoveRow(originalIndex, "DOWN")}
                        onOpenUntaggedVendorToast={() => openUntaggedVendorToast(item, true)}
                        onDuplicateVariant={() => handleDuplicateVariantRow(item.lineId)}
                        onToggleSpec={() => toggleSpecDrawer(item.lineId)}
                        onOpenVendorDialog={() =>
                          setVendorDialogItem({
                            lineId: item.lineId,
                            productId: item.product.id,
                            productName: item.product.materialDescription,
                            currentCp: item.cpSnapshot,
                            currentSp: sp,
                          })
                        }
                        onQuantityChange={(qty) => handleQuantityChange(item.lineId, qty)}
                        onCpChange={(val) => handleCpChange(item.lineId, val)}
                        onSpChange={(val) => handleSpChange(item.lineId, val)}
                        onSaveSp={() =>
                          handleSaveItemSpToCatalog(
                            item.product.id,
                            item.product.materialDescription,
                            sp,
                            cp
                          )
                        }
                        onLeadTimeChange={(lt) => handleLeadTimeChange(item.lineId, lt)}
                        onCommentChange={(c) => handleCommentChange(item.lineId, c)}
                        onProductChange={(field, val) =>
                          handleProductChange(item.lineId, field, val)
                        }
                        onCommissionCpChange={(val) =>
                          handleCommissionCpChange(item.lineId, val)
                        }
                        onAdditionalCostChange={(val) =>
                          handleAdditionalCostChange(item.lineId, val)
                        }
                        onRemove={() => handleRemoveItem(item.lineId)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. Sticky Bottom Summary & Actions Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 md:px-8 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex flex-wrap items-center gap-6">
            {(() => {
              const totalAmount = items.reduce(
                (sum, item) => sum + Math.round((item.spSnapshot || 0) * item.quantity),
                0
              )
              const totalGst = items.reduce(
                (sum, item) =>
                  sum +
                  Math.round(
                    Math.round((item.spSnapshot || 0) * item.quantity) *
                      (item.product.gstRate / 100)
                  ),
                0
              )
              const totalPCost = items.reduce(
                (sum, item) => sum + Math.round((item.cpSnapshot || 0) * item.quantity),
                0
              )

              return (
                <>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Subtotal (Excl. GST)
                    </div>
                    <div className="text-base font-bold font-mono text-slate-900">
                      {formatRupee(totalAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Total Purchase Cost
                    </div>
                    <div className="text-base font-bold font-mono text-amber-700">
                      {formatRupee(totalPCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Estimated Net Profit
                    </div>
                    <MarginIndicator
                      items={items.map((i) => ({
                        spSnapshot: i.spSnapshot || 0,
                        cpSnapshot: i.cpSnapshot || 0,
                        quantity: i.quantity,
                        additionalCost: i.additionalCost,
                      }))}
                    />
                  </div>
                  <div className="pl-4 border-l border-slate-200">
                    <div className="text-[10px] text-orange-600 uppercase font-bold tracking-wider">
                      Grand Total (Incl. GST)
                    </div>
                    <div className="text-xl font-black font-mono text-orange-600">
                      {formatRupee(totalAmount + totalGst)}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 mr-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveSellingPricesToCatalog}
                onChange={(e) => setSaveSellingPricesToCatalog(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span>Save SPs to Catalog & History</span>
            </label>

            <button
              type="button"
              onClick={() => handleSubmit("DRAFT")}
              disabled={isSubmitting || saveStatus === "SAVING"}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors border border-slate-300 disabled:opacity-50 cursor-pointer"
            >
              {saveStatus === "SAVING" ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit("PENDING")}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Check className="w-4 h-4 text-white" />
              )}
              <span>{quotationId ? "Update Quotation" : "Create Quotation"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FragmentRow({
  item,
  originalIndex,
  totalItems,
  sp,
  cp,
  lowestVendor,
  lastClientQuote,
  isPending,
  isFocusedInDock,
  isSpecOpen,
  lineTotal,
  lineProfit,
  marginPct,
  onFocusDock,
  onMoveUp,
  onMoveDown,
  onOpenUntaggedVendorToast,
  onDuplicateVariant,
  onToggleSpec,
  onOpenVendorDialog,
  onQuantityChange,
  onCpChange,
  onSpChange,
  onSaveSp,
  onLeadTimeChange,
  onCommentChange,
  onProductChange,
  onCommissionCpChange,
  onAdditionalCostChange,
  onRemove,
}: {
  item: QuotationLineItem
  originalIndex: number
  totalItems: number
  sp: number
  cp?: number
  lowestVendor: { costPrice: number; supplierId?: string; supplierName?: string } | null
  lastClientQuote: ProductQuotationHistoryItem | null
  isPending: boolean
  isFocusedInDock: boolean
  isSpecOpen: boolean
  lineTotal: number
  lineProfit: number
  marginPct: number | null
  onFocusDock: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onOpenUntaggedVendorToast: () => void
  onDuplicateVariant: () => void
  onToggleSpec: () => void
  onOpenVendorDialog: () => void
  onQuantityChange: (q: number) => void
  onCpChange: (cp: number | undefined) => void
  onSpChange: (sp: number) => void
  onSaveSp: () => void
  onLeadTimeChange: (lt: string) => void
  onCommentChange: (c: string) => void
  onProductChange: (
    field: "materialCode" | "materialDescription" | "unit" | "gstRate" | "specification",
    val: any
  ) => void
  onCommissionCpChange: (val: number) => void
  onAdditionalCostChange: (val: number) => void
  onRemove: () => void
}) {
  return (
    <>
      <tr
        className={`transition-colors ${
          isFocusedInDock
            ? "bg-orange-50/50"
            : isPending
            ? "bg-amber-50/20 hover:bg-slate-50"
            : "hover:bg-slate-50/90"
        }`}
      >
        {/* # & Row Reordering (↑ / ↓) */}
        <td className="py-3 px-2 text-center">
          <div className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={onFocusDock}
              className={`w-6 h-6 rounded-md font-mono text-xs font-bold cursor-pointer transition-colors ${
                isFocusedInDock
                  ? "bg-orange-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-700"
              }`}
              title="Load into Top Quick-Pricing Dock"
            >
              {originalIndex + 1}
            </button>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={originalIndex <= 0}
                className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-25 cursor-pointer"
                title="Move Row Up"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={originalIndex >= totalItems - 1}
                className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-25 cursor-pointer"
                title="Move Row Down"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </td>

        {/* Material Code & Inline Editable Description */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onFocusDock}
              className="font-mono text-xs font-bold text-slate-900 hover:text-orange-600 cursor-pointer"
            >
              {item.product.materialCode}
            </button>
            {isPending && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                Needs Price
              </span>
            )}
          </div>
          <input
            type="text"
            value={item.product.materialDescription}
            onChange={(e) => onProductChange("materialDescription", e.target.value)}
            onFocus={onFocusDock}
            placeholder="Product description / Size / Variant..."
            className="w-full mt-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-orange-500 rounded px-1.5 py-0.5 -ml-1.5 text-xs font-medium text-slate-800 focus:outline-none transition-colors"
            title="Click to edit product description / size for this line"
          />
          <div className="flex items-center gap-2.5 mt-1">
            <button
              type="button"
              onClick={onToggleSpec}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>
                {isSpecOpen
                  ? "Hide Specs & Notes"
                  : item.product.specification || item.comment
                  ? "Edit Specs / Note"
                  : "+ Specs / Freight"}
              </span>
              {isSpecOpen ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={onDuplicateVariant}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
              title="Duplicate this product row to add another Size or Variant"
            >
              <CopyPlus className="w-3 h-3" />
              <span>+ Variant</span>
            </button>
          </div>
        </td>

        {/* Qty & UOM */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-1">
            <SmartNumberInput
              value={item.quantity}
              onValueChange={(val) => onQuantityChange(val || 0)}
              placeholder="0"
              className="w-16 bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-600"
            />
            <span className="text-[11px] font-mono text-slate-500">{item.product.unit}</span>
          </div>
        </td>

        {/* Vendor Cost CP */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-mono z-10 pointer-events-none">
                ₹
              </span>
              <SmartNumberInput
                value={cp ? cp / 100 : ""}
                onValueChange={(val, rawStr) =>
                  onCpChange(rawStr === "" ? undefined : Math.round(val * 100))
                }
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-md pl-5 pr-1.5 py-1 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-orange-600"
              />
            </div>
            <button
              type="button"
              onClick={onOpenVendorDialog}
              className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-md transition-colors cursor-pointer shrink-0"
              title="Select Vendor Rate or View Price History"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </div>
          {cp && cp > 0 && !item.supplierId && !item.supplierName ? (
            <button
              type="button"
              onClick={onOpenUntaggedVendorToast}
              className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold transition-colors cursor-pointer"
            >
              ⚠ No Vendor Tagged · Click to Tag Vendor
            </button>
          ) : (item.supplierName || lowestVendor?.supplierName) ? (
            <div className="text-[10px] text-amber-800 font-medium truncate mt-0.5 flex items-center gap-1">
              <Award className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span className="truncate">{item.supplierName || lowestVendor?.supplierName}</span>
            </div>
          ) : null}
        </td>

        {/* Selling Price SP */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-600 text-[11px] font-mono font-bold z-10 pointer-events-none">
                ₹
              </span>
              <SmartNumberInput
                value={sp > 0 ? sp / 100 : ""}
                onValueChange={(val) => onSpChange(Math.round(val * 100))}
                placeholder="0.00"
                className="w-full bg-white border border-emerald-300 rounded-md pl-5 pr-1.5 py-1 text-xs font-mono font-bold text-emerald-800 focus:outline-none focus:border-emerald-600"
              />
            </div>
            {(cp || lowestVendor?.costPrice) && (!sp || sp === 0) ? (
              <button
                type="button"
                onClick={() =>
                  onSpChange(Math.round((lowestVendor?.costPrice || cp || 0) * 1.2))
                }
                className="px-1.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold cursor-pointer shrink-0"
                title="Apply +20% markup over lowest CP"
              >
                +20%
              </button>
            ) : (
              <button
                type="button"
                onClick={onSaveSp}
                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-colors cursor-pointer shrink-0"
                title="Save Selling Price to Product Catalog & History"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {lastClientQuote && (
            <button
              type="button"
              onClick={() => onSpChange(lastClientQuote.spSnapshot)}
              className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
              title="Click to apply the last Selling Price quoted to this client"
            >
              <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span>
                Last to this client: {formatRupee(lastClientQuote.spSnapshot)} (Click to apply)
              </span>
            </button>
          )}
        </td>

        {/* Line Total */}
        <td className="py-3 px-3 text-right font-mono text-xs font-bold text-slate-900">
          {formatRupee(lineTotal)}
          <div className="text-[10px] font-normal text-slate-400">
            +{item.product.gstRate}% GST
          </div>
        </td>

        {/* Profit / Margin */}
        <td className="py-3 px-3 text-right font-mono text-xs">
          {sp > 0 && cp ? (
            <div>
              <div
                className={`font-bold ${
                  lineProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {formatRupee(lineProfit)}
              </div>
              {marginPct !== null && (
                <div className="text-[10px] text-slate-400">{marginPct.toFixed(1)}%</div>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>

        {/* Lead Time */}
        <td className="py-3 px-3">
          <input
            type="text"
            value={item.leadTime || ""}
            onChange={(e) => onLeadTimeChange(e.target.value)}
            placeholder="2-3 Weeks"
            className="w-full bg-white border border-slate-200 focus:border-orange-500 rounded-md px-2 py-1 text-xs text-slate-700 focus:outline-none"
          />
        </td>

        {/* Actions */}
        <td className="py-3 px-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={onOpenVendorDialog}
              className="px-2 py-1 text-[11px] font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded transition-colors cursor-pointer"
              title="Open Vendor CP & Price History Modal"
            >
              Rates
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
              title="Remove Item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Optional Expandable Sub-Row for Technical Specs, Remarks, Freight & Commission */}
      {isSpecOpen && (
        <tr className="bg-slate-50/90 border-b border-slate-200">
          <td />
          <td colSpan={8} className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Material Code
                </label>
                <input
                  type="text"
                  value={item.product.materialCode}
                  onChange={(e) => onProductChange("materialCode", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Material Description (Line Override)
                </label>
                <input
                  type="text"
                  value={item.product.materialDescription}
                  onChange={(e) => onProductChange("materialDescription", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Technical Specification
                </label>
                <textarea
                  rows={2}
                  value={item.product.specification || ""}
                  onChange={(e) => onProductChange("specification", e.target.value)}
                  placeholder="Detailed technical specifications..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Item Comment / Note
                  </label>
                  <input
                    type="text"
                    value={item.comment || ""}
                    onChange={(e) => onCommentChange(e.target.value)}
                    placeholder="Shown on quotation PDF below specification..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Addnl. Freight (₹)
                    </label>
                    <SmartNumberInput
                      value={item.additionalCost ? item.additionalCost / 100 : ""}
                      onValueChange={(val) => onAdditionalCostChange(Math.round(val * 100))}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Comm. CP (₹)
                    </label>
                    <SmartNumberInput
                      value={
                        item.commissionCpSnapshot !== undefined
                          ? item.commissionCpSnapshot / 100
                          : ""
                      }
                      onValueChange={(val) => onCommissionCpChange(Math.round(val * 100))}
                      placeholder="Optional"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      GST Rate (%)
                    </label>
                    <SmartNumberInput
                      value={item.product.gstRate}
                      onValueChange={(val) => onProductChange("gstRate", val || 0)}
                      placeholder="18"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
