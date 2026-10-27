"use client"
import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  Search,
  Plus,
  User,
  FileText,
  PackagePlus,
  Users,
  Truck,
  ShoppingCart,
  ClipboardList,
  FileSpreadsheet,
  Award,
  Settings,
  LogOut,
  ChevronDown
} from "lucide-react"
import { signOut } from "next-auth/react"

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Executive Overview", subtitle: "Real-time commercial & supply chain performance" },
  "/quotations": { title: "Client Quotations", subtitle: "Manage commercial offers, pricing margins & PO conversions" },
  "/purchase-orders": { title: "Purchase Orders", subtitle: "Track vendor orders, fulfillment & quotation links" },
  "/rfq": { title: "Vendor RFQs", subtitle: "Request for Quotations & supplier inquiry management" },
  "/products": { title: "Product Catalog", subtitle: "Master inventory, cost prices, selling prices & price history" },
  "/clients": { title: "Client Directory", subtitle: "Customer organizations, contacts & tax identifiers" },
  "/suppliers": { title: "Supplier Directory", subtitle: "Approved vendors, contacts & procurement history" },
  "/deliveries": { title: "Deliveries (GRN)", subtitle: "Goods receipt notes & inward delivery tracking" },
  "/purchases": { title: "Purchases & Bills", subtitle: "Direct purchase records & vendor invoices" },
  "/cocs": { title: "Certificates of Conformance", subtitle: "Quality assurance & material conformance documents" },
  "/accounts": { title: "Accounts & Ledger", subtitle: "Financial transactions, balances & cashflow" },
  "/quotation-dues": { title: "Quotation Dues", subtitle: "Pending receivables & payment follow-ups" },
  "/obligations-overview": { title: "Religious Obligations", subtitle: "Khumus & Zakaat calculation and tracking" },
  "/khumus": { title: "Khumus Ledger", subtitle: "Annual Khumus obligations & distributions" },
  "/zakaat": { title: "Zakaat Ledger", subtitle: "Zakaat calculations & charitable records" },
  "/emails": { title: "Email Templates", subtitle: "Standardized templates for RFQs, Quotations & POs" },
  "/settings": { title: "System Settings", subtitle: "Application preferences & security configuration" },
}

export function TopBar() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const handleAction = (path: string) => {
    setIsQuickAddOpen(false)
    setIsUserMenuOpen(false)
    router.push(path)
  }

  const matchedKey = Object.keys(routeTitles)
    .filter((k) => k !== "/")
    .find((k) => pathname.startsWith(k)) || "/"
  const currentMeta = routeTitles[matchedKey] || routeTitles["/"]

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-xs flex items-center justify-between px-6 lg:px-8 sticky top-0 z-30">
      {/* Left: Page Context Breadcrumb */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="hidden sm:block truncate">
          <div className="text-sm font-semibold text-slate-900 truncate">{currentMeta.title}</div>
          <div className="text-xs text-slate-500 truncate">{currentMeta.subtitle}</div>
        </div>
      </div>

      {/* Right: Search + Quick Actions + User Menu */}
      <div className="flex items-center gap-3">
        {/* Global Command Search Trigger */}
        <button
          type="button"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }}
          className="flex items-center gap-2.5 text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-slate-800 transition-colors border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer select-none text-sm"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="hidden md:inline text-xs font-medium text-slate-500">Quick search or jump...</span>
          <kbd className="bg-white px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-500 border border-slate-200 shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* Quick Create Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsQuickAddOpen(!isQuickAddOpen)
              setIsUserMenuOpen(false)
            }}
            className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-xs transition-all cursor-pointer active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="text-white">Create New</span>
            <ChevronDown className="w-3.5 h-3.5 text-white/80 ml-0.5" />
          </button>

          {isQuickAddOpen && (
            <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-xl overflow-hidden z-50 animate-in slide-in-from-top-1 fade-in duration-150 shadow-xl border border-slate-200">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Commercial Documents
              </div>
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={() => handleAction("/quotations/new")}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-orange-600" /> New Client Quotation
                </button>
                <button
                  onClick={() => handleAction("/purchase-orders/new")}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <ClipboardList className="w-4 h-4 text-blue-600" /> New Purchase Order
                </button>
                <button
                  onClick={() => handleAction("/rfq/new")}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> New Vendor RFQ
                </button>
                <button
                  onClick={() => handleAction("/cocs/new")}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <Award className="w-4 h-4 text-emerald-600" /> New Certificate (COC)
                </button>
              </div>

              <div className="px-3 py-2 bg-slate-50 border-y border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Master Records
              </div>
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={() => handleAction("/products/new")}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <PackagePlus className="w-4 h-4 text-slate-500" /> Add Catalog Product
                </button>
                <button
                  onClick={() => handleAction("/clients?action=new-client")}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <Users className="w-4 h-4 text-slate-500" /> Add Client
                </button>
                <button
                  onClick={() => handleAction("/suppliers?action=new-supplier")}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <Truck className="w-4 h-4 text-slate-500" /> Add Supplier
                </button>
                <button
                  onClick={() => handleAction("/purchases?action=new-purchase")}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4 text-slate-500" /> Record Direct Purchase
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsUserMenuOpen(!isUserMenuOpen)
              setIsQuickAddOpen(false)
            }}
            className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
            title="Account & Settings"
          >
            <User className="w-4 h-4" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-xl overflow-hidden z-50 animate-in slide-in-from-top-1 fade-in duration-150 shadow-xl border border-slate-200">
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-800">Radiant Industrial Co.</div>
                <div className="text-[11px] text-slate-500">Administrator</div>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => handleAction("/settings")}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-400" /> System Settings
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left font-medium cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside backdrop */}
      {(isQuickAddOpen || isUserMenuOpen) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setIsQuickAddOpen(false)
            setIsUserMenuOpen(false)
          }}
        />
      )}
    </header>
  )
}
