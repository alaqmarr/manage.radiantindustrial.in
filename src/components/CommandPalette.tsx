"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { 
  FileText, PackagePlus, Users, Truck, ShoppingCart, 
  Search, Calculator, UserPlus
} from "lucide-react"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-black/50 p-4 transition-all">
      <Command 
        className="w-full max-w-2xl bg-premium-surface border border-premium-border rounded-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        label="Global Command Menu"
      >
        <div className="flex items-center border-b border-premium-border px-3">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <Command.Input 
            autoFocus
            className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-zinc-500 p-4 outline-none text-lg"
            placeholder="Type a command or search..." 
          />
          <div className="text-xs font-mono text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded">ESC</div>
        </div>
        
        <Command.List className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
          <Command.Empty className="p-6 text-center text-zinc-400 text-sm">No results found.</Command.Empty>
          
          <Command.Group heading="Create Actions" className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/quotations/new"))}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-zinc-200 hover:bg-brand-orange/20 hover:text-brand-orange cursor-pointer transition-colors aria-selected:bg-brand-orange/20 aria-selected:text-brand-orange"
            >
              <FileText className="w-4 h-4" />
              <span>Create Quotation</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/products/new"))}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-zinc-200 hover:bg-brand-orange/20 hover:text-brand-orange cursor-pointer transition-colors aria-selected:bg-brand-orange/20 aria-selected:text-brand-orange"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Add New Product</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("?action=new-purchase"))}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-zinc-200 hover:bg-brand-orange/20 hover:text-brand-orange cursor-pointer transition-colors aria-selected:bg-brand-orange/20 aria-selected:text-brand-orange"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Create Purchase</span>
            </Command.Item>
          </Command.Group>
          
          <Command.Group heading="Entities" className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-4">
             <Command.Item 
              onSelect={() => runCommand(() => router.push("/clients"))}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-zinc-200 hover:bg-white/10 cursor-pointer transition-colors aria-selected:bg-white/10"
            >
              <Users className="w-4 h-4" />
              <span>Manage Clients</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/suppliers"))}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-zinc-200 hover:bg-white/10 cursor-pointer transition-colors aria-selected:bg-white/10"
            >
              <Truck className="w-4 h-4" />
              <span>Manage Suppliers</span>
            </Command.Item>
          </Command.Group>
          
        </Command.List>
      </Command>
    </div>
  )
}

