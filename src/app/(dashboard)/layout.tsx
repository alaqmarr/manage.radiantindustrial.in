import { Sidebar, SidebarContentWrapper } from "@/components/Sidebar"
import { TopBar } from "@/components/TopBar"
import { CommandPalette } from "@/components/CommandPalette"
import { GlobalModals } from "@/components/GlobalModals"
import { prisma } from "@/lib/prisma"
import { Suspense } from "react"
import { DisableNumberInputScroll } from "@/components/DisableNumberInputScroll"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } })
  const products = await prisma.product.findMany({ select: { id: true, materialCode: true, materialDescription: true, costPrice: true } })

  return (
    <div className="flex bg-slate-50 min-h-screen text-slate-900 print:bg-white print:text-black print:min-h-0 print:block">
      <DisableNumberInputScroll />
      <div className="print:hidden">
        <Sidebar />
      </div>
      <SidebarContentWrapper>
        <div className="print:hidden">
          <TopBar />
        </div>
        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto print:p-0 print:m-0">
          <div className="print:hidden">
            <CommandPalette />
          </div>
          <div className="w-full animate-in fade-in duration-300 print:max-w-none">
            {children}
          </div>
        </main>
      </SidebarContentWrapper>
      <Suspense fallback={null}>
        <GlobalModals suppliers={suppliers} products={products} />
      </Suspense>
    </div>
  )
}
