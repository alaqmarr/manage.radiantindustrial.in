"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSmartPurchaseId } from "@/lib/smartId"

async function validateDirectPurchaseAgainstQuotation(
  quotationId: string,
  items: { productId: string; quantity: number }[],
  productMap: Record<string, any>,
  excludePurchaseId?: string
) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      items: true,
      purchases: {
        where: excludePurchaseId ? { id: { not: excludePurchaseId } } : undefined,
        include: {
          items: true,
          supplier: { select: { name: true } },
        },
      },
      purchaseOrders: {
        where: { status: { not: "CANCELLED" } },
        include: {
          items: true,
          supplier: { select: { name: true } },
        },
      },
    },
  })

  if (!quotation) return

  // Aggregate requested quantities per productId
  const requestedByProduct = new Map<string, number>()
  for (const item of items) {
    requestedByProduct.set(
      item.productId,
      (requestedByProduct.get(item.productId) || 0) + (Number(item.quantity) || 0)
    )
  }

  for (const [productId, reqQty] of requestedByProduct.entries()) {
    const product = productMap[productId]
    const code = product?.materialCode || productId
    const unit = product?.unit || "NUM"

    const matchingQItems = quotation.items.filter((qi) => qi.productId === productId)
    const confirmedQItems = matchingQItems.filter((qi) => qi.isConfirmed !== false)

    if (matchingQItems.length > 0 && confirmedQItems.length === 0) {
      throw new Error(
        `Item "${code}" was marked as Not Ordered by the client in this quotation.`
      )
    }

    const existingPurchasesForProd = quotation.purchases.filter((p) =>
      p.items.some((pi) => pi.productId === productId)
    )
    const existingPosForProd = quotation.purchaseOrders.filter((po) =>
      po.items.some((pi) => pi.productId === productId)
    )

    if (existingPurchasesForProd.length === 0 && existingPosForProd.length === 0) {
      continue
    }

    const alreadyViaPurchase = existingPurchasesForProd.reduce((sum, p) => {
      return (
        sum +
        p.items
          .filter((pi) => pi.productId === productId)
          .reduce((s, pi) => s + (pi.quantity || 0), 0)
      )
    }, 0)

    const alreadyViaPo = existingPosForProd.reduce((sum, po) => {
      return (
        sum +
        po.items
          .filter((pi) => pi.productId === productId)
          .reduce((s, pi) => s + (pi.quantity || 0), 0)
      )
    }, 0)

    const alreadyProcuredQty = alreadyViaPurchase + alreadyViaPo
    const sourceLabels = [
      ...existingPosForProd.map(
        (po) => `PO ${po.poNumber || po.id.toUpperCase()} (${po.supplier.name})`
      ),
      ...existingPurchasesForProd.map(
        (p) => `Direct Purchase #${p.id.toUpperCase()} (${p.supplier.name})`
      ),
    ].join(", ")

    if (confirmedQItems.length > 0) {
      const totalConfirmedQuotedQty = confirmedQItems.reduce((s, qi) => s + qi.quantity, 0)
      if (alreadyProcuredQty >= totalConfirmedQuotedQty) {
        throw new Error(
          `Duplicate procurement prevented: "${code}" is already fully ordered/purchased (${alreadyProcuredQty}/${totalConfirmedQuotedQty} ${unit}) for this quotation under ${sourceLabels}.`
        )
      }
      if (alreadyProcuredQty + reqQty > totalConfirmedQuotedQty) {
        const remaining = Math.max(0, totalConfirmedQuotedQty - alreadyProcuredQty)
        throw new Error(
          `Quantity exceeded for "${code}": ${alreadyProcuredQty} of ${totalConfirmedQuotedQty} ${unit} is already procured under ${sourceLabels}. Only ${remaining} ${unit} remaining.`
        )
      }
    } else if (existingPurchasesForProd.length > 0 || existingPosForProd.length > 0) {
      throw new Error(
        `Item "${code}" is already recorded for this quotation under ${sourceLabels}.`
      )
    }
  }
}

export async function createPurchase(payload: {
  supplierId: string
  quotationId?: string
  items: { productId: string, quantity: number, cpSnapshot: number }[]
}) {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Generate a smart ascending ID for the purchase
    const id = await generateSmartPurchaseId(payload.supplierId)

    // Calculate totals
    let totalAmount = 0
    let totalGst = 0

    // Fetch product details to get GST rates
    const productIds = payload.items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    })
    
    const productMap = products.reduce((acc, p) => {
      acc[p.id] = p
      return acc
    }, {} as Record<string, any>)

    // If tagging a quotation, ensure we aren't double-purchasing items across POs + Direct Purchases
    if (payload.quotationId) {
      await validateDirectPurchaseAgainstQuotation(
        payload.quotationId,
        payload.items,
        productMap
      )
    }

    const itemsToCreate = payload.items.map((item, idx) => {
      const product = productMap[item.productId]
      const amount = item.cpSnapshot * item.quantity
      const gst = Math.round(amount * (product.gstRate / 100))
      
      totalAmount += amount
      totalGst += gst

      return {
        id: `${id}-item-${idx + 1}`,
        productId: item.productId,
        quantity: item.quantity,
        cpSnapshot: item.cpSnapshot
      }
    })

    const purchase = await prisma.purchase.create({
      data: {
        id,
        supplierId: payload.supplierId,
        quotationId: payload.quotationId || null,
        totalAmount,
        totalGst,
        items: {
          create: itemsToCreate
        }
      }
    })

    // Also upsert ProductSupplier entries to maintain up-to-date vendor prices
    for (const item of payload.items) {
      await prisma.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: item.productId,
            supplierId: payload.supplierId
          }
        },
        update: {
          costPrice: item.cpSnapshot
        },
        create: {
          productId: item.productId,
          supplierId: payload.supplierId,
          costPrice: item.cpSnapshot
        }
      })
    }

    // Update QuotationItem cpSnapshot if tagged to a quotation
    if (payload.quotationId) {
      for (const item of payload.items) {
        await prisma.quotationItem.updateMany({
          where: { quotationId: payload.quotationId, productId: item.productId },
          data: { cpSnapshot: item.cpSnapshot, supplierId: payload.supplierId }
        })
      }
      revalidatePath(`/quotations/${payload.quotationId}`)
      revalidatePath("/quotations")
    }
    revalidatePath("/purchases")

    return { success: true, id: purchase.id }
  } catch (error: any) {
    console.error("Error creating purchase:", error)
    return { success: false, error: error.message || "Failed to create purchase" }
  }
}

export async function updatePurchase(id: string, payload: {
  supplierId: string
  quotationId?: string
  items: { productId: string, quantity: number, cpSnapshot: number }[]
}) {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Calculate totals
    let totalAmount = 0
    let totalGst = 0

    // Fetch product details to get GST rates
    const productIds = payload.items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    })
    
    const productMap = products.reduce((acc, p) => {
      acc[p.id] = p
      return acc
    }, {} as Record<string, any>)

    if (payload.quotationId) {
      await validateDirectPurchaseAgainstQuotation(
        payload.quotationId,
        payload.items,
        productMap,
        id
      )
    }

    const itemsToCreate = payload.items.map((item, idx) => {
      const product = productMap[item.productId]
      const amount = item.cpSnapshot * item.quantity
      const gst = Math.round(amount * (product.gstRate / 100))
      
      totalAmount += amount
      totalGst += gst

      return {
        id: `${id}-item-${idx + 1}`,
        productId: item.productId,
        quantity: item.quantity,
        cpSnapshot: item.cpSnapshot
      }
    })

    // Delete existing items
    const purchase = await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: id }
      })

      return await tx.purchase.update({
        where: { id },
        data: {
          supplierId: payload.supplierId,
          quotationId: payload.quotationId || null,
          totalAmount,
          totalGst,
          items: {
            create: itemsToCreate
          }
        }
      })
    })

    // Also upsert ProductSupplier entries
    for (const item of payload.items) {
      await prisma.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: item.productId,
            supplierId: payload.supplierId
          }
        },
        update: {
          costPrice: item.cpSnapshot
        },
        create: {
          productId: item.productId,
          supplierId: payload.supplierId,
          costPrice: item.cpSnapshot
        }
      })
    }

    // Update QuotationItem cpSnapshot if tagged to a quotation
    if (payload.quotationId) {
      for (const item of payload.items) {
        await prisma.quotationItem.updateMany({
          where: { quotationId: payload.quotationId, productId: item.productId },
          data: { cpSnapshot: item.cpSnapshot, supplierId: payload.supplierId }
        })
      }
      revalidatePath(`/quotations/${payload.quotationId}`)
      revalidatePath("/quotations")
    }
    revalidatePath("/purchases")

    return { success: true }
  } catch (error: any) {
    console.error("Error updating purchase:", error)
    return { success: false, error: error.message || "Failed to update purchase" }
  }
}
