"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  PackageSearch,
  FileText,
  Users,
  Truck,
  ShoppingCart,
  Settings,
  LogOut,
  ChevronRight,
  Mail,
  Award,
  Wallet,
  ClipboardList,
  HandCoins,
  Heart,
  HandHeart,
  FileSpreadsheet,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { getSidebarBadgesAction, type SidebarBadges } from "@/app/actions/search"

const SIDEBAR_STORAGE_KEY = "radiant_sidebar_collapsed"
const SIDEBAR_TOGGLE_EVENT = "radiant-sidebar-toggle"

const menuGroups = [
  {
    label: "Overview",
    items: [{ icon: LayoutDashboard, label: "Dashboard", href: "/" }],
  },
  {
    label: "Sales & Quotations",
    items: [
      { icon: FileText, label: "Quotations", href: "/quotations" },
      { icon: Award, label: "Certificates (COC)", href: "/cocs" },
      { icon: Users, label: "Clients", href: "/clients" },
      { icon: Mail, label: "Email Templates", href: "/emails" },
    ],
  },
  {
    label: "Procurement & Catalog",
    items: [
      { icon: PackageSearch, label: "Product Catalog", href: "/products" },
      { icon: FileSpreadsheet, label: "Vendor RFQs", href: "/rfq" },
      { icon: ClipboardList, label: "Purchase Orders", href: "/purchase-orders" },
      { icon: Truck, label: "Deliveries (GRN)", href: "/deliveries" },
      { icon: ShoppingCart, label: "Purchases & Bills", href: "/purchases" },
      { icon: Truck, label: "Suppliers", href: "/suppliers" },
    ],
  },
  {
    label: "Finance & Ledger",
    items: [
      { icon: Wallet, label: "Accounts & Ledger", href: "/accounts" },
      { icon: Clock, label: "Quotation Dues", href: "/quotation-dues" },
    ],
  },
  {
    label: "Religious Obligations",
    items: [
      { icon: HandHeart, label: "Obligations Overview", href: "/obligations-overview" },
      { icon: HandCoins, label: "Khumus", href: "/khumus" },
      { icon: Heart, label: "Zakaat", href: "/zakaat" },
    ],
  },
  {
    label: "Administration",
    items: [{ icon: Settings, label: "System Settings", href: "/settings" }],
  },
]

export function SidebarContentWrapper({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (saved === "true") setCollapsed(true)
    } catch {}

    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ collapsed: boolean }>
      if (customEvent.detail && typeof customEvent.detail.collapsed === "boolean") {
        setCollapsed(customEvent.detail.collapsed)
      }
    }

    window.addEventListener(SIDEBAR_TOGGLE_EVENT, handleToggle)
    return () => window.removeEventListener(SIDEBAR_TOGGLE_EVENT, handleToggle)
  }, [])

  return (
    <div
      className={`${
        collapsed ? "ml-18" : "ml-64"
      } flex-1 flex flex-col min-h-screen transition-all duration-200 print:ml-0 print:block print:min-h-0`}
    >
      {children}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [badges, setBadges] = useState<SidebarBadges>({
    quotationsNeedingAction: 0,
    openRfqs: 0,
    draftPos: 0,
    unpaidDues: 0,
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (saved === "true") setCollapsed(true)
    } catch {}
  }, [])

  useEffect(() => {
    let active = true
    getSidebarBadgesAction()
      .then((data) => {
        if (active && data) setBadges(data)
      })
      .catch((err) => console.error("Failed to fetch sidebar badges:", err))
    return () => {
      active = false
    }
  }, [pathname])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
    } catch {}
    window.dispatchEvent(
      new CustomEvent(SIDEBAR_TOGGLE_EVENT, { detail: { collapsed: next } })
    )
  }

  if (pathname === "/login") return null

  const getBadgeForHref = (href: string): { count: number; style: string; title: string } | null => {
    switch (href) {
      case "/quotations":
        return badges.quotationsNeedingAction > 0
          ? {
              count: badges.quotationsNeedingAction,
              style: "bg-orange-100 text-orange-700 border-orange-200",
              title: `${badges.quotationsNeedingAction} quotation(s) pending or awaiting PO`,
            }
          : null
      case "/rfq":
        return badges.openRfqs > 0
          ? {
              count: badges.openRfqs,
              style: "bg-indigo-100 text-indigo-700 border-indigo-200",
              title: `${badges.openRfqs} open issued RFQ(s)`,
            }
          : null
      case "/purchase-orders":
        return badges.draftPos > 0
          ? {
              count: badges.draftPos,
              style: "bg-blue-100 text-blue-700 border-blue-200",
              title: `${badges.draftPos} draft Purchase Order(s)`,
            }
          : null
      case "/quotation-dues":
        return badges.unpaidDues > 0
          ? {
              count: badges.unpaidDues,
              style: "bg-rose-100 text-rose-700 border-rose-200",
              title: `${badges.unpaidDues} quotation(s) with unpaid client dues`,
            }
          : null
      default:
        return null
    }
  }

  return (
    <aside
      className={`${
        collapsed ? "w-18" : "w-64"
      } bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 text-slate-700 z-40 select-none transition-all duration-200`}
    >
      {/* Brand Header */}
      <div
        className={`h-16 ${
          collapsed ? "px-2 justify-center" : "px-4 justify-between"
        } border-b border-slate-200 flex items-center shrink-0 bg-white`}
      >
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5 focus:outline-none min-w-0">
            <img
              src="/logo-long.png"
              alt="Radiant Industrial Co."
              className="h-7 object-contain"
            />
          </Link>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className={`flex-1 ${
          collapsed ? "px-2 py-4 gap-3" : "px-3 py-5 gap-5"
        } overflow-y-auto custom-scrollbar flex flex-col`}
      >
        {menuGroups.map((group, idx) => (
          <div key={idx}>
            {!collapsed ? (
              <div className="px-3 mb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                {group.label}
              </div>
            ) : (
              idx > 0 && <div className="h-px bg-slate-100 mx-2 mb-2" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href))
                const badge = getBadgeForHref(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={
                      collapsed
                        ? badge
                          ? `${item.label} (${badge.count})`
                          : item.label
                        : badge?.title
                    }
                    className={`group relative flex items-center ${
                      collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2"
                    } rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-orange-50 text-orange-700 font-semibold border border-orange-200/70 shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
                    }`}
                  >
                    <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3 min-w-0"}`}>
                      <item.icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-orange-600"
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!collapsed ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {badge && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full border leading-none ${badge.style}`}
                          >
                            {badge.count}
                          </span>
                        )}
                        {isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
                        ) : (
                          !badge && (
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-400 shrink-0" />
                          )
                        )}
                      </div>
                    ) : (
                      badge && (
                        <span
                          className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full border flex items-center justify-center leading-none ${badge.style}`}
                        >
                          {badge.count}
                        </span>
                      )
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / Sign Out */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50/70">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Sign Out" : undefined}
          className={`flex w-full items-center ${
            collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2"
          } text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors rounded-lg group text-sm font-medium cursor-pointer`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </div>
          {!collapsed && (
            <span className="text-[10px] font-mono text-slate-400 group-hover:text-rose-500">
              Exit
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}
