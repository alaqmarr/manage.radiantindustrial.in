"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export type ObligationType = "KHUMUS" | "ZAKAAT"

export interface ObligationQuotationDetail {
  quotationId: string
  clientName: string
  totalValue: number // paise
  totalProfit: number // paise
  amountPaid: number // paise
  realizedProfit: number // paise
  dueAmount: number // paise (Khumus or Zakaat depending on calculation)
  expectedDueAmount: number // paise (Total expected when 100% paid)
  date: Date
}

export interface ObligationSummary {
  quotations: ObligationQuotationDetail[]
  totalDue: number
  totalExpectedDue: number
  totalPaid: number
  outstanding: number
}

export async function getObligationSummary(type: ObligationType): Promise<ObligationSummary> {
  // 1. Fetch all quotations that are either ACCEPTED or have received payments
  const quotations = await prisma.quotation.findMany({
    where: {
      OR: [
        { status: "ACCEPTED" },
        { amountPaid: { gt: 0 } }
      ]
    },
    include: {
      client: true,
      items: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  let totalDue = 0
  let totalExpectedDue = 0
  const quotationDetails: ObligationQuotationDetail[] = []

  for (const q of quotations) {
    const totalGst = q.totalGst
    const totalValueWithGst = q.totalAmount + totalGst

    // Calculate Total Profit for this quotation
    let totalProfit = 0
    for (const item of q.items) {
      const sp = item.spSnapshot || 0
      const cp = item.cpSnapshot || 0
      const additionalCost = item.additionalCost || 0
      totalProfit += ((sp - cp) * item.quantity) - additionalCost
    }

    // Cap payment ratio at 1
    const paymentRatio = totalValueWithGst > 0 ? Math.min(1, q.amountPaid / totalValueWithGst) : 0
    const realizedProfit = totalProfit * paymentRatio

    // Calculate dues based on type
    const multiplier = type === "KHUMUS" ? (1 / 5) : (1 / 40)
    const realizedDueAmount = realizedProfit * multiplier
    const expectedDueAmount = totalProfit * multiplier

    // Only include in the list if there is some profit expected or generated
    if (expectedDueAmount > 0 || realizedDueAmount > 0) {
      totalDue += realizedDueAmount
      totalExpectedDue += expectedDueAmount
      quotationDetails.push({
        quotationId: q.id,
        clientName: q.client.name,
        totalValue: totalValueWithGst,
        totalProfit,
        amountPaid: q.amountPaid,
        realizedProfit,
        dueAmount: realizedDueAmount,
        expectedDueAmount,
        date: q.createdAt
      })
    }
  }

  // 2. Fetch total paid from ledger
  const payments = await prisma.obligationPayment.findMany({
    where: { type }
  })
  const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0)

  return {
    quotations: quotationDetails,
    totalDue,
    totalExpectedDue,
    totalPaid,
    outstanding: totalDue - totalPaid
  }
}

export async function getObligationPayments(type: ObligationType) {
  return prisma.obligationPayment.findMany({
    where: { type },
    orderBy: { date: 'desc' }
  })
}

export async function recordObligationPayment(data: {
  type: ObligationType
  amount: number // paise
  date: Date
  notes?: string
}) {
  try {
    const payment = await prisma.obligationPayment.create({
      data: {
        type: data.type,
        amount: data.amount,
        date: data.date,
        notes: data.notes
      }
    })
    revalidatePath(`/${data.type.toLowerCase()}`)
    return { success: true, payment }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
