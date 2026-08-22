import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { QuotationActions } from "@/components/QuotationActions"
import { QuotationStatusBadge } from "@/components/QuotationStatusBadge"
import { PaymentSection } from "@/components/PaymentSection"
import { Metadata } from "next"
import { formatRupee, numberToWordsRupees } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Quotation ${id}`
  }
}

export default async function QuotationViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      client: true,
      items: {
        include: { product: true }
      },
      payments: {
        orderBy: { date: 'desc' }
      }
    }
  })

  if (!quotation) {
    redirect("/quotations")
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  const isDraft = quotation.status === "DRAFT"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl py-4 -mx-8 px-8 border-b border-premium-border/50 mb-6 print:static print:bg-transparent print:border-none print:p-0 print:m-0 print:mb-6">
        <div className="print:hidden">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Quotation {quotation.id.slice(-6).toUpperCase()}</h1>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">Status:</span>
            <QuotationStatusBadge id={quotation.id} currentStatus={quotation.status} />
          </div>
        </div>
        <QuotationActions quotation={quotation} settings={settings} />
      </div>

      {/* Dashboard View Container */}
      <div className="glass-panel p-8 rounded-lg relative overflow-hidden print:hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header Section */}
        <div className="flex justify-between items-start mb-12 border-b border-premium-border pb-8 relative z-10">
          <div>
            <img src={settings?.logoUrl || "/logo-long.png"} alt="Logo" className="h-16 object-contain mb-4" />
            <div className="text-zinc-400 text-sm mt-4 space-y-1">
              <p><strong>To:</strong> {quotation.client.name}</p>
              {quotation.prNo && <p><strong>PR No:</strong> {quotation.prNo}</p>}
              {quotation.rfqNo && <p><strong>RFQ No:</strong> {quotation.rfqNo}</p>}
            </div>
          </div>
          <div className="text-right text-zinc-400 text-sm space-y-1">
            <p><strong>Date:</strong> {new Date(quotation.createdAt).toLocaleDateString()}</p>
            <p><strong>Quote No:</strong> {quotation.id}</p>
          </div>
        </div>

        {/* Message */}
        {settings?.quotationMessage && (
          <p 
            className="text-zinc-300 mb-8 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: settings.quotationMessage }}
          />
        )}

        {/* Items Table */}
        <div className="mb-12 relative z-10">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-white/5 text-zinc-400 border-y border-premium-border">
              <tr>
                <th className="py-3 px-4 font-medium w-32">Code</th>
                <th className="py-3 px-4 font-medium min-w-[300px] w-auto">Description</th>
                <th className="py-3 px-4 font-medium text-center w-20">UOM</th>
                <th className="py-3 px-4 font-medium text-center w-24">Qty</th>
                <th className="py-3 px-4 font-medium text-right w-32">Rate</th>
                <th className="py-3 px-4 font-medium text-right w-32">Amount</th>
                <th className="py-3 px-4 font-medium text-right w-32 text-amber-500/80">P. Cost</th>
                <th className="py-3 px-4 font-medium text-right w-32 text-amber-500/80">P. GST</th>
                <th className="py-3 px-4 font-medium text-right w-32 text-emerald-500/80">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {quotation.items.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 even:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-4 text-white font-mono text-xs">{item.product.materialCode}</td>
                  <td className="py-4 px-4">
                    <div className="text-zinc-300">{item.product.materialDescription}</div>
                    {item.product.specification && (
                      <div className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{item.product.specification}</div>
                    )}
                    {item.comment && (
                      <div className="text-xs text-brand-orange/80 mt-1 italic whitespace-pre-wrap break-words">{item.comment}</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center text-zinc-400 text-xs font-mono">{item.product.unit}</td>
                  <td className="py-4 px-4 text-center text-zinc-300">{item.quantity}</td>
                  
                  <td className="py-4 px-4 text-right text-zinc-300">{formatRupee(item.spSnapshot)}</td>
                  <td className="py-4 px-4 text-right text-white font-medium">{formatRupee(Math.round(item.spSnapshot * item.quantity))}</td>
                  <td className="py-4 px-4 text-right text-amber-500/80">
                    {formatRupee(Math.round((item.cpSnapshot || 0) * item.quantity))}
                  </td>
                  <td className="py-4 px-4 text-right text-amber-500/80">
                    {formatRupee(Math.round(Math.round((item.cpSnapshot || 0) * item.quantity) * (item.gstSnapshot / 100)))}
                  </td>
                  <td className="py-4 px-4 text-right text-emerald-500 font-medium">
                    {formatRupee(Math.round((item.spSnapshot - (item.cpSnapshot || 0)) * item.quantity))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>



        <div className="hidden print:flex justify-end mb-12">
            <div className="w-72 space-y-3 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal (excl. GST)</span>
                <span>{formatRupee(quotation.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total GST</span>
                <span>{formatRupee(quotation.totalGst)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-brand-orange pt-3 border-t border-premium-border">
                <span>Grand Total</span>
                <span>{formatRupee(quotation.totalAmount + quotation.totalGst)}</span>
              </div>
              <div className="flex justify-between text-amber-500/80 font-medium pt-3 border-t border-premium-border/50">
                <span>Total P. Cost</span>
                <span>
                  {formatRupee(
                    quotation.items.reduce((sum, item) => {
                      return sum + Math.round((item.cpSnapshot || 0) * item.quantity);
                    }, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-amber-500/80 font-medium">
                <span>Total P. GST</span>
                <span>
                  {formatRupee(
                    quotation.items.reduce((sum, item) => {
                      return sum + Math.round(Math.round((item.cpSnapshot || 0) * item.quantity) * (item.gstSnapshot / 100));
                    }, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-emerald-500 font-medium pt-3 border-t border-premium-border/50">
                <span>Est. Total Profit</span>
                <span>
                  {formatRupee(
                    quotation.items.reduce((sum, item) => {
                      return sum + Math.round((item.spSnapshot - (item.cpSnapshot || 0)) * item.quantity);
                    }, 0)
                  )}
                </span>
              </div>
              {(() => {
                const totalPCost = quotation.items.reduce((sum, item) => sum + Math.round((item.cpSnapshot || 0) * item.quantity), 0);
                const totalCommCost = quotation.items.reduce((sum, item) => {
                  const commCp = (item.commissionCpSnapshot !== undefined && item.commissionCpSnapshot !== null) 
                    ? item.commissionCpSnapshot 
                    : (item.cpSnapshot || 0);
                  return sum + Math.round(commCp * item.quantity);
                }, 0);
                
                if (totalCommCost !== totalPCost) {
                  return (
                    <>
                      <div className="flex justify-between text-brand-orange/90 font-medium pt-3 border-t border-premium-border/50">
                        <span>Comm. P. Cost</span>
                        <span>{formatRupee(totalCommCost)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-500 font-medium">
                        <span>Comm. Profit</span>
                        <span>{formatRupee(quotation.totalAmount - totalCommCost)}</span>
                      </div>
                    </>
                  )
                }
                return null;
              })()}
            </div>
          </div>

        {/* Bottom Details */}
        {settings?.bottomDetails && (
          <div 
            className="pt-8 border-t border-premium-border text-sm text-zinc-500 whitespace-pre-wrap relative z-10"
            dangerouslySetInnerHTML={{ __html: settings.bottomDetails }}
          />
        )}
        
        <div className="pt-4 text-sm font-medium text-zinc-400">
          Amount in words: <span className="text-white">{numberToWordsRupees(quotation.totalAmount + quotation.totalGst)}</span>
        </div>

      </div>
      
      {!isDraft && (
        <PaymentSection
          type="quotation"
          entityId={quotation.id}
          totalAmount={quotation.totalAmount}
          totalGst={quotation.totalGst}
          amountPaid={quotation.amountPaid}
          paymentStatus={quotation.paymentStatus}
          paymentDueDate={quotation.paymentDueDate}
          payments={quotation.payments}
        />
      )}

      {/* Totals (Sticky Bottom Bar) */}
      <div className="h-32 print:hidden"></div>
      <div className="fixed bottom-0 left-0 md:left-64 right-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-t border-premium-border/50 p-4 md:px-8 flex flex-wrap items-center justify-start gap-6 md:gap-12 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-4 print:hidden">
        {(() => {
          const totalAmount = quotation.totalAmount;
          const totalGst = quotation.totalGst;
          const totalPCost = quotation.items.reduce((sum, item) => sum + Math.round((item.cpSnapshot || 0) * item.quantity), 0);
          const totalProfit = totalAmount - totalPCost;
          const marginPercent = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
          
          const totalCommCost = quotation.items.reduce((sum, item) => {
            const commCp = (item.commissionCpSnapshot !== undefined && item.commissionCpSnapshot !== null) 
              ? item.commissionCpSnapshot 
              : (item.cpSnapshot || 0);
            return sum + Math.round(commCp * item.quantity);
          }, 0);
          const totalCommProfit = totalAmount - totalCommCost;
          const commMarginPercent = totalAmount > 0 ? (totalCommProfit / totalAmount) * 100 : 0;
          
          const hasCommSplit = totalCommCost !== totalPCost;
          
          return (
            <>
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Subtotal</div>
                <div className="text-lg font-bold text-white">{formatRupee(totalAmount)}</div>
              </div>
              
              <div className="flex gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Act. P. Cost</div>
                  <div className="text-lg font-bold text-amber-500/90">{formatRupee(totalPCost)}</div>
                </div>
                {hasCommSplit && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-brand-orange/80 uppercase font-bold tracking-widest">Comm. P. Cost</div>
                    <div className="text-lg font-bold text-brand-orange/90">{formatRupee(totalCommCost)}</div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Act. Profit</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-emerald-500">{formatRupee(totalProfit)}</span>
                    {totalProfit > 0 && <span className="text-xs text-emerald-500/70 font-medium">({marginPercent.toFixed(1)}%)</span>}
                  </div>
                </div>
                {hasCommSplit && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-brand-orange/80 uppercase font-bold tracking-widest">Comm. Profit</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-emerald-500">{formatRupee(totalCommProfit)}</span>
                      {totalCommProfit > 0 && <span className="text-xs text-emerald-500/70 font-medium">({commMarginPercent.toFixed(1)}%)</span>}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="hidden lg:block w-px h-10 bg-premium-border/50"></div>
              
              <div className="space-y-1">
                <div className="text-[10px] text-brand-orange/80 uppercase font-bold tracking-widest">Grand Total (inc. GST)</div>
                <div className="text-2xl font-black text-brand-orange">{formatRupee(totalAmount + totalGst)}</div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  )
}
