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
async function recalculateParentPayment(type: "quotation" | "po", entityId: string) {
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
  }
}

export async function recordPayment(data: {
  type: "quotation" | "po"
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
        ...(data.type === "quotation" ? { quotationId: data.entityId } : { poId: data.entityId })
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

    await prisma.payment.delete({ where: { id: paymentId } })

    if (quotationId) {
      await recalculateParentPayment("quotation", quotationId)
    } else if (poId) {
      await recalculateParentPayment("po", poId)
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
      }
    })

    revalidatePath("/accounts")
    return { success: true, payment }
  } catch (error: any) {
    console.error("Error recording manual payment:", error)
    return { error: error.message || "Failed to record manual payment" }
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
        po: { select: { poNumber: true, id: true, supplier: { select: { name: true } } } }
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
      where: { status: { in: ['ACCEPTED', 'COMPLETED'] } }
    })
    const accountsReceivable = pendingQuotations.reduce((sum, q) => sum + Math.max(0, (q.totalAmount + q.totalGst) - q.amountPaid), 0)

    // Calculate Accounts Payable (Unpaid amount of all POs except CANCELLED)
    const pendingPOs = await prisma.purchaseOrder.findMany({
      where: { status: { not: 'CANCELLED' } }
    })
    const accountsPayable = pendingPOs.reduce((sum, po) => sum + Math.max(0, (po.totalAmount + po.totalGst) - po.amountPaid), 0)

    // Calculate Pending Fulfillment Cost (Expected cost to fulfill ACCEPTED quotations)
    // We only sum this for ACCEPTED. Once COMPLETED, we assume goods were purchased and PO handles the cost.
    const acceptedQuotations = await prisma.quotation.findMany({
      where: { status: 'ACCEPTED' },
      include: { items: true }
    })
    let pendingFulfillmentCost = 0
    for (const q of acceptedQuotations) {
      for (const item of q.items) {
        pendingFulfillmentCost += ((item.cpSnapshot || 0) * item.quantity) + (item.additionalCost || 0)
      }
    }

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
      pendingFulfillmentCost
    }
  } catch (error: any) {
    console.error("Error fetching metrics:", error)
    return { error: error.message || "Failed to fetch metrics" }
  }
}
