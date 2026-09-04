"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

function computePaymentStatus(amountPaid: number, totalAmount: number, totalGst: number): string {
  const total = totalAmount + totalGst
  if (total > 0) {
    if (amountPaid >= total) return "PAID"
    if (amountPaid > 0) return "PARTIALLY_PAID"
    return "UNPAID"
  }
  return amountPaid > 0 ? "PAID" : "UNPAID"
}

// Recalculate and update the parent entity's amountPaid based ONLY on CLEARED payments.
async function recalculateParentPayment(type: "quotation" | "po" | "purchase", entityId: string) {
  if (type === "quotation") {
    const quotation = await prisma.quotation.findUnique({ where: { id: entityId } })
    if (!quotation) return
    const payments = await prisma.payment.findMany({
      where: { quotationId: entityId, status: "CLEARED" }
    })
    const totalPaidPaise = payments.reduce((sum, p) => sum + p.amount, 0)
    const newStatus = computePaymentStatus(totalPaidPaise, quotation.totalAmount, quotation.totalGst)
    await prisma.quotation.update({
      where: { id: entityId },
      data: { amountPaid: totalPaidPaise, paymentStatus: newStatus }
    })
    revalidatePath("/quotations")
    revalidatePath(`/quotations/${entityId}`)
  } else if (type === "po") {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: entityId } })
    if (!po) return
    const payments = await prisma.payment.findMany({
      where: { poId: entityId, status: "CLEARED" }
    })
    const totalPaidPaise = payments.reduce((sum, p) => sum + p.amount, 0)
    const newStatus = computePaymentStatus(totalPaidPaise, po.totalAmount, po.totalGst)
    await prisma.purchaseOrder.update({
      where: { id: entityId },
      data: { amountPaid: totalPaidPaise, paymentStatus: newStatus }
    })
    revalidatePath("/purchase-orders")
    revalidatePath(`/purchase-orders/${entityId}`)
  } else if (type === "purchase") {
    const purchase = await prisma.purchase.findUnique({ where: { id: entityId } })
    if (!purchase) return
    const payments = await prisma.payment.findMany({
      where: { purchaseId: entityId, status: "CLEARED" }
    })
    const totalPaidPaise = payments.reduce((sum, p) => sum + p.amount, 0)
    const newStatus = computePaymentStatus(totalPaidPaise, purchase.totalAmount, purchase.totalGst)
    await prisma.purchase.update({
      where: { id: entityId },
      data: { amountPaid: totalPaidPaise, paymentStatus: newStatus }
    })
    revalidatePath("/purchases")
  }
}

export async function recordPayment(data: {
  type: "quotation" | "po" | "purchase"
  entityId: string
  amount: number // in RUPEES
  method: string
  reference?: string
  notes?: string
  date?: string
  status?: string // Optional status, defaults to CLEARED, or PENDING if future cheque
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    if (!data.entityId) return { error: "Entity ID is required" }
    if (typeof data.amount !== "number" || isNaN(data.amount) || data.amount <= 0) {
      return { error: "Please enter a valid positive payment amount" }
    }

    const amountInPaise = Math.round(data.amount * 100)
    const paymentDate = data.date ? new Date(data.date) : new Date()
    
    // Auto status logic if not provided
    let status = data.status || "CLEARED"
    if (!data.status && data.method === "CHEQUE" && paymentDate > new Date()) {
      status = "PENDING"
    }

    const ledgerType = data.type === "quotation" ? "IN" : "OUT"

    const payment = await prisma.payment.create({
      data: {
        type: ledgerType,
        status,
        amount: amountInPaise,
        method: data.method,
        reference: data.reference?.trim() || null,
        notes: data.notes?.trim() || null,
        date: paymentDate,
        ...(data.type === "quotation" ? { quotationId: data.entityId } : 
           data.type === "po" ? { poId: data.entityId } : 
           { purchaseId: data.entityId })
      }
    })

    await recalculateParentPayment(data.type, data.entityId)
    revalidatePath("/accounts")
    return { success: true, payment }
  } catch (error: any) {
    console.error("Error recording payment:", error)
    return { error: error.message || "Failed to record payment" }
  }
}

export async function deletePayment(paymentId: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) return { error: "Payment not found" }

    const quotationId = payment.quotationId
    const poId = payment.poId
    const purchaseId = payment.purchaseId

    await prisma.payment.delete({ where: { id: paymentId } })

    if (quotationId) {
      await recalculateParentPayment("quotation", quotationId)
    } else if (poId) {
      await recalculateParentPayment("po", poId)
    } else if (purchaseId) {
      await recalculateParentPayment("purchase", purchaseId)
    }
    
    revalidatePath("/accounts")
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting payment:", error)
    return { error: error.message || "Failed to delete payment" }
  }
}

export async function getPayments(type: "quotation" | "po", entityId: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const payments = await prisma.payment.findMany({
      where: type === "quotation" ? { quotationId: entityId } : { poId: entityId },
      orderBy: { date: "desc" }
    })
    return { success: true, payments }
  } catch (error: any) {
    console.error("Error fetching payments:", error)
    return { error: error.message || "Failed to fetch payments" }
  }
}

export async function recordBulkPayment(data: { clientId: string, amount: number, method: string, reference: string, notes: string, date: string, status: string }) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const amountPaise = Math.round(data.amount * 100)
    let remainingAmount = amountPaise

    const quotations = await prisma.quotation.findMany({
      where: {
        clientId: data.clientId,
        status: { in: ['ACCEPTED', 'COMPLETED'] }
      },
      orderBy: { createdAt: 'asc' }
    })

    const unpaidQuotations = quotations.filter(q => (q.totalAmount + q.totalGst - q.amountPaid) > 0)

    for (const q of unpaidQuotations) {
      if (remainingAmount <= 0) break

      const due = (q.totalAmount + q.totalGst) - q.amountPaid
      const applyAmount = Math.min(due, remainingAmount)

      await prisma.payment.create({
        data: {
          type: "IN",
          category: "quotation",
          amount: applyAmount,
          method: data.method,
          reference: data.reference ? `${data.reference} (Bulk)` : "Bulk Payment",
          notes: data.notes,
          date: new Date(data.date),
          status: data.status,
          quotationId: q.id
        }
      })

      remainingAmount -= applyAmount
      await recalculateParentPayment("quotation", q.id)
    }

    if (remainingAmount > 0) {
      await prisma.client.update({
        where: { id: data.clientId },
        data: { creditBalance: { increment: remainingAmount } }
      })
      const client = await prisma.client.findUnique({ where: { id: data.clientId } })
      await prisma.payment.create({
        data: {
          type: "IN",
          category: "ADVANCE",
          entityName: client?.name || "Client",
          amount: remainingAmount,
          method: data.method,
          reference: data.reference ? `${data.reference} (Advance)` : "Client Advance",
          notes: data.notes,
          date: new Date(data.date),
          status: data.status
        }
      })
    }

    revalidatePath("/accounts")
    revalidatePath("/quotation-dues")
    revalidatePath(`/clients/${data.clientId}`)
    return { success: true }
  } catch (error: any) {
    console.error("Error processing bulk payment:", error)
    return { error: error.message || "Failed to process bulk payment" }
  }
}

export async function updatePaymentStatus(paymentId: string, status: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status }
    })

    if (payment.quotationId) {
      await recalculateParentPayment("quotation", payment.quotationId)
    } else if (payment.poId) {
      await recalculateParentPayment("po", payment.poId)
    } else if (payment.purchaseId) {
      await recalculateParentPayment("purchase", payment.purchaseId)
    }
    
    revalidatePath("/accounts")
    return { success: true, payment }
  } catch (error: any) {
    console.error("Error updating payment status:", error)
    return { error: error.message || "Failed to update payment status" }
  }
}

export async function recordManualPayment(data: {
  type: "IN" | "OUT"
  amount: number // in RUPEES
  method: string
  reference?: string
  notes?: string
  date?: string
  status?: string
  category?: string
  entityName?: string
  untagged?: boolean
  clientId?: string
  supplierId?: string
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    if (typeof data.amount !== "number" || isNaN(data.amount) || data.amount <= 0) {
      return { error: "Please enter a valid positive payment amount" }
    }

    const amountInPaise = Math.round(data.amount * 100)
    const paymentDate = data.date ? new Date(data.date) : new Date()
    
    let status = data.status || "CLEARED"
    if (!data.status && data.method === "CHEQUE" && paymentDate > new Date()) {
      status = "PENDING"
    }

    const payment = await prisma.payment.create({
      data: {
        type: data.type,
        status,
        amount: amountInPaise,
        method: data.method,
        reference: data.reference?.trim() || null,
        notes: data.notes?.trim() || null,
        date: paymentDate,
        category: data.category || "MANUAL",
        entityName: data.entityName?.trim() || null,
        untagged: data.untagged || false,
        clientId: data.clientId || null,
        supplierId: data.supplierId || null,
      }
    })

    revalidatePath("/accounts")
    return { success: true, payment }
  } catch (error: any) {
    console.error("Error recording manual payment:", error)
    return { error: error.message || "Failed to record manual payment" }
  }
}

export async function resolveUntaggedPayment(paymentId: string, quotationId: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment || !payment.untagged) return { error: "Untagged payment not found" }
    
    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } })
    if (!quotation) return { error: "Quotation not found" }
    
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        untagged: false,
        category: "quotation",
        quotationId: quotationId,
        clientId: null, // Clear this since we now link directly to quotation
      }
    })
    
    await recalculateParentPayment("quotation", quotationId)
    revalidatePath("/accounts")
    return { success: true }
  } catch (error: any) {
    console.error("Error resolving untagged payment:", error)
    return { error: error.message || "Failed to resolve payment" }
  }
}

export async function getLedgerEntries() {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const entries = await prisma.payment.findMany({
      orderBy: { date: "desc" },
      include: {
        quotation: { select: { id: true, client: { select: { name: true } } } },
        po: { select: { poNumber: true, id: true, supplier: { select: { name: true } } } },
        purchase: { select: { id: true, supplier: { select: { name: true } } } },
        client: { select: { name: true } },
        supplier: { select: { name: true } }
      }
    })
    return { success: true, entries }
  } catch (error: any) {
    console.error("Error fetching ledger:", error)
    return { error: error.message || "Failed to fetch ledger entries" }
  }
}

export async function getAccountMetrics() {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const allClearedIn = await prisma.payment.aggregate({
      where: { type: 'IN', status: 'CLEARED' },
      _sum: { amount: true }
    })
    
    const allClearedOut = await prisma.payment.aggregate({
      where: { type: 'OUT', status: 'CLEARED' },
      _sum: { amount: true }
    })

    const allPendingIn = await prisma.payment.aggregate({
      where: { type: 'IN', status: 'PENDING' },
      _sum: { amount: true }
    })

    const allPendingOut = await prisma.payment.aggregate({
      where: { type: 'OUT', status: 'PENDING' },
      _sum: { amount: true }
    })

    // Calculate Accounts Receivable (Unpaid amount of ACCEPTED and COMPLETED Quotations)
    const pendingQuotations = await prisma.quotation.findMany({
      where: { status: { in: ['ACCEPTED', 'COMPLETED'] } },
      include: { client: { select: { name: true } } }
    })
    let accountsReceivable = 0
    const receivablesBreakdown = pendingQuotations.map(q => {
      const due = Math.max(0, (q.totalAmount + q.totalGst) - q.amountPaid)
      accountsReceivable += due
      return { id: q.id, name: q.client.name, total: q.totalAmount + q.totalGst, paid: q.amountPaid, due, status: q.status }
    }).filter(q => q.due > 0)

    // Calculate Accounts Payable (Unpaid amount of all POs except CANCELLED and DRAFT + Unpaid Purchases)
    const pendingPOs = await prisma.purchaseOrder.findMany({
      where: { status: { notIn: ['CANCELLED', 'DRAFT'] } },
      include: { supplier: { select: { name: true } } }
    })
    const pendingPurchases = await prisma.purchase.findMany({
      include: { supplier: { select: { name: true } } }
    })
    
    let accountsPayable = 0
    const poBreakdown = pendingPOs.map(po => {
      const due = Math.max(0, (po.totalAmount + po.totalGst) - po.amountPaid)
      accountsPayable += due
      return { id: po.id, name: po.supplier.name, total: po.totalAmount + po.totalGst, paid: po.amountPaid, due, type: 'PO' }
    }).filter(p => p.due > 0)

    const purchaseBreakdown = pendingPurchases.map(p => {
      const due = Math.max(0, (p.totalAmount + p.totalGst) - p.amountPaid)
      accountsPayable += due
      return { id: p.id, name: p.supplier.name, total: p.totalAmount + p.totalGst, paid: p.amountPaid, due, type: 'Direct Purchase' }
    }).filter(p => p.due > 0)

    const payablesBreakdown = [...poBreakdown, ...purchaseBreakdown]

    // Calculate Pending Fulfillment Cost (Expected cost to fulfill ACCEPTED quotations)
    const acceptedQuotations = await prisma.quotation.findMany({
      where: { status: 'ACCEPTED' },
      include: { items: true, purchases: true, purchaseOrders: true, client: { select: { name: true } } }
    })
    let pendingFulfillmentCost = 0
    const fulfillmentsBreakdown = []
    
    for (const q of acceptedQuotations) {
      let estCost = 0
      for (const item of q.items) {
        estCost += ((item.cpSnapshot || 0) * item.quantity) + (item.additionalCost || 0)
      }
      
      let alreadyPurchasedCost = 0
      for (const p of q.purchases) {
        alreadyPurchasedCost += p.totalAmount // Exclude GST to match estCost
      }
      for (const po of q.purchaseOrders) {
        if (po.status !== 'CANCELLED') {
          alreadyPurchasedCost += po.totalAmount // Exclude GST
        }
      }
      
      const uncovered = Math.max(0, estCost - alreadyPurchasedCost)
      pendingFulfillmentCost += uncovered
      
      if (uncovered > 0) {
        fulfillmentsBreakdown.push({
          id: q.id,
          name: q.client.name,
          estCost,
          alreadyPurchasedCost,
          uncovered
        })
      }
    }

    // ── P&L from ALL accepted/completed quotations (including fully paid ones) ──
    const allPnlQuotations = await prisma.quotation.findMany({
      where: { status: { in: ['ACCEPTED', 'COMPLETED'] } },
      include: { items: true, client: { select: { name: true } } }
    })

    let totalRevenue = 0
    let totalCogs = 0
    let totalAdditionalExpenses = 0
    const pnlBreakdown: Array<{ id: string; clientName: string; status: string; revenue: number; cogs: number; expenses: number; profit: number }> = []

    for (const q of allPnlQuotations) {
      let revenue = 0
      let cogs = 0
      let expenses = 0
      for (const item of q.items) {
        revenue += (item.spSnapshot || 0) * item.quantity
        cogs += (item.cpSnapshot || 0) * item.quantity
        expenses += item.additionalCost || 0
      }
      totalRevenue += revenue
      totalCogs += cogs
      totalAdditionalExpenses += expenses
      pnlBreakdown.push({
        id: q.id,
        clientName: q.client.name,
        status: q.status,
        revenue,
        cogs,
        expenses,
        profit: revenue - cogs - expenses
      })
    }

    const grossProfit = totalRevenue - totalCogs
    const netProfit = grossProfit - totalAdditionalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // ── Loan calculations ──
    const loanIn = await prisma.payment.aggregate({
      where: { category: 'LOAN', type: 'IN', status: 'CLEARED' },
      _sum: { amount: true }
    })
    const loanOut = await prisma.payment.aggregate({
      where: { category: 'LOAN', type: 'OUT', status: 'CLEARED' },
      _sum: { amount: true }
    })
    const totalBorrowed = loanIn._sum.amount || 0
    const totalLent = loanOut._sum.amount || 0
    const netLoanPosition = totalBorrowed - totalLent // positive = you owe, negative = others owe you

    // ── Client credit balances ──
    const clientCredits = await prisma.client.aggregate({
      _sum: { creditBalance: true }
    })
    const totalClientCredit = clientCredits._sum.creditBalance || 0

    const totalIn = allClearedIn._sum.amount || 0
    const totalOut = allClearedOut._sum.amount || 0
    const balance = totalIn - totalOut

    return {
      success: true,
      balance,
      pendingIn: allPendingIn._sum.amount || 0,
      pendingOut: allPendingOut._sum.amount || 0,
      accountsReceivable,
      accountsPayable,
      pendingFulfillmentCost,
      receivablesBreakdown,
      payablesBreakdown,
      fulfillmentsBreakdown,
      // P&L
      totalRevenue,
      totalCogs,
      totalAdditionalExpenses,
      grossProfit,
      netProfit,
      profitMargin,
      pnlBreakdown,
      pnlQuotationCount: allPnlQuotations.length,
      // Loans
      totalBorrowed,
      totalLent,
      netLoanPosition,
      // Client credits
      totalClientCredit
    }
  } catch (error: any) {
    console.error("Error fetching metrics:", error)
    return { error: error.message || "Failed to fetch metrics" }
  }
}
