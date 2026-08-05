import { Sidebar } from "@/components/Sidebar"
import { TopBar } from "@/components/TopBar"
import { CommandPalette } from "@/components/CommandPalette"
import { GlobalModals } from "@/components/GlobalModals"
import { prisma } from "@/lib/prisma"
import { Suspense } from "react"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } })
  const products = await prisma.product.findMany({ select: { id: true, materialCode: true, materialDescription: true, costPrice: true } })
  return (
    <div className="flex bg-premium-dark min-h-screen text-zinc-200 print:bg-white print:text-black">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="ml-64 flex-1 flex flex-col min-h-screen print:ml-0 print:block">
        <div className="print:hidden">
          <TopBar />
        </div>
        <main className="flex-1 p-8 print:p-0 print:m-0">
          <div className="print:hidden">
            <CommandPalette />
          </div>
          <div className="max-w-7xl mx-auto w-full animate-in fade-in duration-500 print:max-w-none">
            {children}
          </div>
        </main>
      </div>
      <Suspense fallback={null}>
        <GlobalModals suppliers={suppliers} products={products} />
      </Suspense>
    </div>
  )
}
