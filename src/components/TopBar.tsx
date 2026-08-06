"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  Bell, Search, Plus, User, FileText, PackagePlus, Users, Truck, ShoppingCart
} from "lucide-react"
import { signOut } from "next-auth/react"

export function TopBar() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const router = useRouter()

  const handleAction = (path: string) => {
    setIsQuickAddOpen(false)
    setIsUserMenuOpen(false)
    router.push(path)
  }

  return (
    <div className="h-16 border-b border-premium-border bg-premium-surface/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Search / Command Hint */}
      <div 
        className="flex items-center gap-2 text-zinc-400 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors border border-premium-border rounded-md px-3 py-1.5 cursor-pointer select-none"
        onClick={() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
        }}
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Search or jump to...</span>
        <div className="flex items-center gap-1 ml-4">
          <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono border border-premium-border">⌘</kbd>
          <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono border border-premium-border">K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Add Dropdown */}
        <div className="relative">
          <button 
            onClick={() => { setIsQuickAddOpen(!isQuickAddOpen); setIsUserMenuOpen(false); }}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange text-white px-4 py-2 rounded-md font-medium shadow-lg shadow-brand-orange/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Add</span>
          </button>
          
          {isQuickAddOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 glass-panel rounded-md overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200 shadow-2xl border border-premium-border">
              <div className="p-1">
                <button 
                  onClick={() => handleAction("/quotations/new")}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 rounded-md transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-zinc-400" /> Create Quotation
                </button>
                <button 
                  onClick={() => handleAction("/products/new")}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 rounded-md transition-colors text-left"
                >
                  <PackagePlus className="w-4 h-4 text-zinc-400" /> Add Product
                </button>
                <button 
                  onClick={() => handleAction("/purchases?action=new-purchase")}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 rounded-md transition-colors text-left"
                >
                  <ShoppingCart className="w-4 h-4 text-zinc-400" /> Create Purchase
                </button>
                <div className="h-px bg-premium-border my-1 mx-2" />
                <button 
                  onClick={() => handleAction("/clients?action=new-client")}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 rounded-md transition-colors text-left"
                >
                  <Users className="w-4 h-4 text-zinc-400" /> Add Client
                </button>
                <button 
                  onClick={() => handleAction("/suppliers?action=new-supplier")}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 rounded-md transition-colors text-left"
                >
                  <Truck className="w-4 h-4 text-zinc-400" /> Add Supplier
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button className="w-10 h-10 rounded-full bg-zinc-900 border border-premium-border flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors relative cursor-pointer active:scale-95">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-brand-orange rounded-full shadow-[0_0_8px_rgba(244,140,54,0.8)]"></span>
        </button>
        
        {/* User Profile */}
        <div className="relative">
          <button 
            onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setIsQuickAddOpen(false); }}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-premium-border flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors overflow-hidden active:scale-95 cursor-pointer"
          >
            <User className="w-5 h-5" />
          </button>
          
          {isUserMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 glass-panel rounded-md overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200 shadow-2xl border border-premium-border">
              <div className="p-1">
                <button 
                  onClick={() => handleAction("/settings")}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 rounded-md transition-colors text-left"
                >
                  Profile Settings
                </button>
                <div className="h-px bg-premium-border my-1 mx-2" />
                <button 
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors text-left"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close dropdowns on click outside */}
      {(isQuickAddOpen || isUserMenuOpen) && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => { setIsQuickAddOpen(false); setIsUserMenuOpen(false); }}
        />
      )}
    </div>
  )
}

