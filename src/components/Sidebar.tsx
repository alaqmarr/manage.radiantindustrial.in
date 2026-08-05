"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { 
  LayoutDashboard, 
  PackageSearch, 
  FileText, 
  Users, 
  Truck,
  ShoppingCart,
  Settings,
  LogOut
} from "lucide-react"
import { signOut } from "next-auth/react"

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: PackageSearch, label: "Products", href: "/products" },
  { icon: FileText, label: "Quotations", href: "/quotations" },
  { icon: ShoppingCart, label: "Purchases", href: "/purchases" },
  { icon: Users, label: "Clients", href: "/clients" },
  { icon: Truck, label: "Suppliers", href: "/suppliers" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export function Sidebar() {
  const pathname = usePathname()

  if (pathname === "/login") return null

  return (
    <div className="w-64 bg-premium-dark border-r border-premium-border flex flex-col h-screen fixed left-0 top-0 text-zinc-300 z-50">
      <div className="h-16 px-6 border-b border-premium-border flex items-center shrink-0">
        <img src="/logo-long-white.png" alt="Radiant Industrial Co." className="h-7 object-contain opacity-90" />
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}>
              <span className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative ${isActive ? 'text-brand-orange shadow-[0_0_15px_rgba(244,140,54,0.15)]' : 'hover:bg-white/5 hover:text-white'}`}>
                {isActive && (
                  <motion.div 
                    layoutId="active-nav"
                    className="absolute inset-0 bg-brand-orange/10 border border-brand-orange/20 rounded-xl -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className="w-5 h-5" />
                <span className="font-medium tracking-wide text-sm">{item.label}</span>
              </span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-premium-border bg-premium-surface/30">
        <button 
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors rounded-xl"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium tracking-wide text-sm">Logout</span>
        </button>
      </div>
    </div>
  )
}
