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

export async function recordPayment(data: {
  type: "quotation" | "po"
  entityId: string
  amount: number // in RUPEES
  method: string
  reference?: string
  notes?: string
  date?: string
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!data.entityId) {
      return { error: "Entity ID is required" }
    }

    if (typeof data.amount !== "number" || isNaN(data.amount) || data.amount <= 0) {
      return { error: "Please enter a valid positive payment amount" }
    }

    const amountInPaise = Math.round(data.amount * 100)
    const paymentDate = data.date ? new Date(data.date) : new Date()

    if (data.type === "quotation") {
      const quotation = await prisma.quotation.findUnique({
        where: { id: data.entityId }
      })

      if (!quotation) {
        return { error: "Quotation not found" }
      }

      const payment = await prisma.payment.create({
        data: {
          amount: amountInPaise,
          method: data.method,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
          date: paymentDate,
          quotationId: data.entityId
        }
      })

      const payments = await prisma.payment.findMany({
        where: { quotationId: data.entityId }
      })

      const totalPaidPaise = payments.reduce((sum, p) => sum + p.amount, 0)
      const newStatus = computePaymentStatus(totalPaidPaise, quotation.totalAmount, quotation.totalGst)

      await prisma.quotation.update({
        where: { id: data.entityId },
        data: {
          amountPaid: totalPaidPaise,
          paymentStatus: newStatus
        }
      })

      revalidatePath("/quotations")
      revalidatePath(`/quotations/${data.entityId}`)

      return { success: true, payment }
    } else if (data.type === "po") {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.entityId }
      })

      if (!po) {
        return { error: "Purchase order not found" }
      }

      const payment = await prisma.payment.create({
        data: {
          amount: amountInPaise,
          method: data.method,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
          date: paymentDate,
          poId: data.entityId
        }
      })

      const payments = await prisma.payment.findMany({
        where: { poId: data.entityId }
      })

      const totalPaidPaise = payments.reduce((sum, p) => sum + p.amount, 0)
      const newStatus = computePaymentStatus(totalPaidPaise, po.totalAmount, po.totalGst)

      await prisma.purchaseOrder.update({
        where: { id: data.entityId },
        data: {
          amountPaid: totalPaidPaise,
          paymentStatus: newStatus
        }
      })

      revalidatePath("/purchase-orders")
      revalidatePath(`/purchase-orders/${data.entityId}`)

      return { success: true, payment }
    } else {
      return { error: "Invalid payment type" }
    }
  } catch (error: any) {
    console.error("Error recording payment:", error)
    return { error: error.message || "Failed to record payment" }
  }
}

export async function deletePayment(paymentId: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    })

    if (!payment) {
      return { error: "Payment not found" }
    }

    const quotationId = payment.quotationId
    const poId = payment.poId

    await prisma.payment.delete({
      where: { id: paymentId }
    })

    if (quotationId) {
      const quotation = await prisma.quotation.findUnique({
        where: { id: quotationId }
      })

      if (quotation) {
        const remainingPayments = await prisma.payment.findMany({
          where: { quotationId }
        })

        const totalPaidPaise = remainingPayments.reduce((sum, p) => sum + p.amount, 0)
        const newStatus = computePaymentStatus(totalPaidPaise, quotation.totalAmount, quotation.totalGst)

        await prisma.quotation.update({
          where: { id: quotationId },
          data: {
            amountPaid: totalPaidPaise,
            paymentStatus: newStatus
          }
        })
      }

      revalidatePath("/quotations")
      revalidatePath(`/quotations/${quotationId}`)
    } else if (poId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId }
      })

      if (po) {
        const remainingPayments = await prisma.payment.findMany({
          where: { poId }
        })

        const totalPaidPaise = remainingPayments.reduce((sum, p) => sum + p.amount, 0)
        const newStatus = computePaymentStatus(totalPaidPaise, po.totalAmount, po.totalGst)

        await prisma.purchaseOrder.update({
          where: { id: poId },
          data: {
            amountPaid: totalPaidPaise,
            paymentStatus: newStatus
          }
        })
      }

      revalidatePath("/purchase-orders")
      revalidatePath(`/purchase-orders/${poId}`)
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error deleting payment:", error)
    return { error: error.message || "Failed to delete payment" }
  }
}

export async function getPayments(type: "quotation" | "po", entityId: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    const payments = await prisma.payment.findMany({
      where: type === "quotation" ? { quotationId: entityId } : { poId: entityId },
      orderBy: { date: "desc" }
    })

    return { success: true, payments }
  } catch (error: any) {
    console.error("Error getting payments:", error)
    return { error: error.message || "Failed to fetch payments" }
  }
}
