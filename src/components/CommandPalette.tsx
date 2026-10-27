"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  FileText,
  PackagePlus,
  Users,
  Truck,
  ShoppingCart,
  Search,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Wallet,
  Package,
  Building2,
  Loader2,
  ArrowUpRight,
  Clock,
  Award,
  Settings,
} from "lucide-react"
import { globalSearchAction, type GlobalSearchResults } from "@/app/actions/search"
import { formatRupee, formatShortId } from "@/lib/utils"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GlobalSearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery("")
      return
    }

    let active = true
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const data = await globalSearchAction(query)
        if (active) {
          setResults(data)
        }
      } catch (err) {
        console.error("Global search error:", err)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }, 200)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [open, query])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  if (!open) return null

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "ACCEPTED":
      case "COMPLETED":
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "PENDING":
      case "ISSUED":
      case "ACKNOWLEDGED":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "REJECTED":
      case "CANCELLED":
        return "bg-rose-50 text-rose-700 border-rose-200"
      default:
        return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-slate-900/40 backdrop-blur-xs transition-all"
      onClick={() => setOpen(false)}
    >
      <Command
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        label="Global Command Menu"
      >
        <div className="flex items-center border-b border-slate-200 px-4 bg-slate-50/70">
          {loading ? (
            <Loader2 className="w-4 h-4 text-orange-600 shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-900 placeholder:text-slate-400 px-3 py-3.5 outline-none text-sm font-medium"
            placeholder="Search quotations, POs, material codes, clients, suppliers, or jump to page..."
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 mr-2 px-1.5 py-0.5 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <kbd className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[68vh] overflow-y-auto p-2 custom-scrollbar">
          <Command.Empty className="p-8 text-center text-slate-500 text-sm">
            No matching records or commands found for{" "}
            <span className="font-semibold text-slate-800">&ldquo;{query}&rdquo;</span>.
          </Command.Empty>

          {/* Live Entity Group: Quotations */}
          {results && results.quotations.length > 0 && (
            <Command.Group
              heading={query.trim() ? "Matching Quotations" : "Recent Quotations"}
              className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"
            >
              {results.quotations.map((q) => (
                <Command.Item
                  key={`quote-${q.id}`}
                  value={`quotation ${q.id} ${formatShortId(q.id)} ${q.prNo || ""} ${q.rfqNo || ""} ${q.client.name} ${q.status} ${query}`}
                  onSelect={() => runCommand(() => router.push(`/quotations/${q.id}`))}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-900 cursor-pointer transition-colors aria-selected:bg-orange-50 aria-selected:text-orange-900 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-orange-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          #{formatShortId(q.id)}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {q.client.name}
                        </span>
                        {q.prNo && (
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            PR: {q.prNo}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getStatusStyle(
                        q.status
                      )}`}
                    >
                      {q.status}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {formatRupee(q.totalAmount)}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-aria-selected:text-orange-600" />
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Live Entity Group: Purchase Orders */}
          {results && results.purchaseOrders.length > 0 && (
            <Command.Group
              heading={query.trim() ? "Matching Purchase Orders" : "Recent Purchase Orders"}
              className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1"
            >
              {results.purchaseOrders.map((po) => (
                <Command.Item
                  key={`po-${po.id}`}
                  value={`purchase order po ${po.id} ${po.poNumber || ""} ${formatShortId(po.id)} ${po.supplier.name} ${po.status} ${query}`}
                  onSelect={() => runCommand(() => router.push(`/purchase-orders/${po.id}`))}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-blue-50/70 hover:text-blue-900 cursor-pointer transition-colors aria-selected:bg-blue-50/70 aria-selected:text-blue-900 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ClipboardList className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {po.poNumber || `#${formatShortId(po.id)}`}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">
                        {po.supplier.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getStatusStyle(
                        po.status
                      )}`}
                    >
                      {po.status}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {formatRupee(po.totalAmount)}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-aria-selected:text-blue-600" />
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Live Entity Group: Catalog Products */}
          {results && results.products.length > 0 && (
            <Command.Group
              heading={query.trim() ? "Catalog Products" : "Recent Catalog Products"}
              className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1"
            >
              {results.products.map((p) => (
                <Command.Item
                  key={`prod-${p.id}`}
                  value={`product catalog ${p.materialCode} ${p.materialDescription} ${p.make || ""} ${query}`}
                  onSelect={() => runCommand(() => router.push(`/products/${p.id}/edit`))}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-900 cursor-pointer transition-colors aria-selected:bg-emerald-50/70 aria-selected:text-emerald-900 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-800 shrink-0">
                        {p.materialCode}
                      </span>
                      <span className="font-medium text-slate-800 truncate">
                        {p.materialDescription}
                      </span>
                      {p.make && (
                        <span className="text-xs text-slate-400 shrink-0">({p.make})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-500">
                      CP: {formatRupee(p.costPrice)}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      SP: {formatRupee(p.sellingPrice)}
                    </span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Live Entity Group: Clients */}
          {results && results.clients.length > 0 && (
            <Command.Group
              heading="Clients"
              className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1"
            >
              {results.clients.map((c) => (
                <Command.Item
                  key={`client-${c.id}`}
                  value={`client customer ${c.name} ${c.gstNumber || ""} ${c.location || ""} ${query}`}
                  onSelect={() => runCommand(() => router.push(`/clients/${c.id}`))}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
                    {c.location && <span>{c.location}</span>}
                    {c.gstNumber && (
                      <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {c.gstNumber}
                      </span>
                    )}
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Live Entity Group: Suppliers */}
          {results && results.suppliers.length > 0 && (
            <Command.Group
              heading="Suppliers"
              className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1"
            >
              {results.suppliers.map((s) => (
                <Command.Item
                  key={`supplier-${s.id}`}
                  value={`supplier vendor ${s.name} ${s.gstNumber || ""} ${s.location || ""} ${query}`}
                  onSelect={() => runCommand(() => router.push(`/suppliers/${s.id}`))}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Truck className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
                    {s.location && <span>{s.location}</span>}
                    {s.gstNumber && (
                      <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {s.gstNumber}
                      </span>
                    )}
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group
            heading="Quick Create"
            className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2"
          >
            <Command.Item
              value="create new quotation quote offer"
              onSelect={() => runCommand(() => router.push("/quotations/new"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer transition-colors aria-selected:bg-orange-50 aria-selected:text-orange-700 font-medium"
            >
              <FileText className="w-4 h-4 text-orange-600" />
              <span>Create New Quotation</span>
            </Command.Item>
            <Command.Item
              value="create purchase order po vendor order"
              onSelect={() => runCommand(() => router.push("/purchase-orders/new"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer transition-colors aria-selected:bg-orange-50 aria-selected:text-orange-700 font-medium"
            >
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <span>Create Purchase Order (PO)</span>
            </Command.Item>
            <Command.Item
              value="create vendor rfq request for quotation"
              onSelect={() => runCommand(() => router.push("/rfq/new"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer transition-colors aria-selected:bg-orange-50 aria-selected:text-orange-700 font-medium"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Create Vendor RFQ</span>
            </Command.Item>
            <Command.Item
              value="add new product catalog material"
              onSelect={() => runCommand(() => router.push("/products/new"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer transition-colors aria-selected:bg-orange-50 aria-selected:text-orange-700 font-medium"
            >
              <PackagePlus className="w-4 h-4 text-emerald-600" />
              <span>Add New Product to Catalog</span>
            </Command.Item>
            <Command.Item
              value="record direct purchase bill invoice"
              onSelect={() => runCommand(() => router.push("/purchases?action=new-purchase"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer transition-colors aria-selected:bg-orange-50 aria-selected:text-orange-700 font-medium"
            >
              <ShoppingCart className="w-4 h-4 text-slate-500" />
              <span>Record Direct Purchase</span>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Navigate"
            className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2"
          >
            <Command.Item
              value="navigate executive dashboard home overview"
              onSelect={() => runCommand(() => router.push("/"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <LayoutDashboard className="w-4 h-4 text-slate-500" />
              <span>Executive Dashboard</span>
            </Command.Item>
            <Command.Item
              value="navigate all quotations sales"
              onSelect={() => runCommand(() => router.push("/quotations"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>All Quotations</span>
            </Command.Item>
            <Command.Item
              value="navigate all purchase orders pos"
              onSelect={() => runCommand(() => router.push("/purchase-orders"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <ClipboardList className="w-4 h-4 text-slate-500" />
              <span>All Purchase Orders</span>
            </Command.Item>
            <Command.Item
              value="navigate product catalog price history"
              onSelect={() => runCommand(() => router.push("/products"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <PackagePlus className="w-4 h-4 text-slate-500" />
              <span>Product Catalog & Price History</span>
            </Command.Item>
            <Command.Item
              value="navigate manage clients customers"
              onSelect={() => runCommand(() => router.push("/clients"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>Manage Clients</span>
            </Command.Item>
            <Command.Item
              value="navigate manage suppliers vendors"
              onSelect={() => runCommand(() => router.push("/suppliers"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <Truck className="w-4 h-4 text-slate-500" />
              <span>Manage Suppliers</span>
            </Command.Item>
            <Command.Item
              value="navigate quotation dues receivables unpaid"
              onSelect={() => runCommand(() => router.push("/quotation-dues"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Quotation Dues & Receivables</span>
            </Command.Item>
            <Command.Item
              value="navigate certificates of conformance coc"
              onSelect={() => runCommand(() => router.push("/cocs"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <Award className="w-4 h-4 text-slate-500" />
              <span>Certificates of Conformance (COC)</span>
            </Command.Item>
            <Command.Item
              value="navigate accounts financial ledger payments"
              onSelect={() => runCommand(() => router.push("/accounts"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <Wallet className="w-4 h-4 text-slate-500" />
              <span>Accounts & Financial Ledger</span>
            </Command.Item>
            <Command.Item
              value="navigate system settings configuration"
              onSelect={() => runCommand(() => router.push("/settings"))}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors aria-selected:bg-slate-100 font-medium"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>System Settings</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  )
}
