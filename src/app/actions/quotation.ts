"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"
import { generateSmartQuotationId } from "@/lib/smartId"

type QuotationItemData = {
  product: {
    id: string
    materialCode: string
    materialDescription: string
    unit: string
    gstRate: number
    specification?: string | null
  }
  quantity: number
  quotedQuantity?: number | null
  isConfirmed?: boolean
  spSnapshot: number // paise
  cpSnapshot?: number // paise
  commissionCpSnapshot?: number // paise
  supplierId?: string
  comment?: string
  leadTime?: string
  additionalCost?: number // paise
}

export async function getQuotationUpdatedAt(id: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const q = await prisma.quotation.findUnique({
      where: { id },
      select: { updatedAt: true },
    })

    if (!q) return { error: "Not found" }

    return { success: true, updatedAt: q.updatedAt }
  } catch {
    return { error: "Failed to check status" }
  }
}

async function syncProductsAndPriceHistory(
  items: QuotationItemData[],
  saveSellingPricesToCatalog = true
) {
  // Count how many line items share the same materialCode so multiple variants (e.g. SIZE A & SIZE B)
  // don't overwrite the base product's catalog description
  const codeCounts = new Map<string, number>()
  for (const item of items) {
    const code = (item.product.materialCode || "").trim().toUpperCase()
    if (code) {
      codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
    }
  }

  for (const item of items) {
    const materialCode =
      (item.product.materialCode || "").trim() ||
      `RAD-${Math.floor(10000000 + Math.random() * 90000000)}`
    const isMultiVariant = (codeCounts.get(materialCode.toUpperCase()) || 0) > 1

    const existing = await prisma.product.findUnique({
      where: { materialCode },
      include: { _count: { select: { priceHistory: true } } },
    })

    const nextSp =
      saveSellingPricesToCatalog && item.spSnapshot > 0
        ? Math.round(item.spSnapshot)
        : existing?.sellingPrice || 0

    const nextCp =
      saveSellingPricesToCatalog && item.cpSnapshot && item.cpSnapshot > 0
        ? Math.round(item.cpSnapshot)
        : existing?.costPrice || 0

    if (!existing) {
      const newId = generateSlug(`${materialCode} ${item.product.materialDescription}`, true)
      const created = await prisma.product.create({
        data: {
          id: newId,
          materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit || "NUM",
          gstRate: item.product.gstRate,
          specification: item.product.specification,
          costPrice: nextCp,
          sellingPrice: nextSp,
        },
      })
      item.product.id = created.id

      if (nextCp > 0 || nextSp > 0) {
        await prisma.priceHistory.create({
          data: {
            productId: created.id,
            costPrice: nextCp,
            sellingPrice: nextSp,
          },
        })
      }
    } else {
      const priceChanged =
        saveSellingPricesToCatalog &&
        ((item.spSnapshot > 0 && existing.sellingPrice !== nextSp) ||
          (item.cpSnapshot && item.cpSnapshot > 0 && existing.costPrice !== nextCp))

      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: {
          // Only overwrite base catalog description/spec if there's a single line item for this code
          ...(!isMultiVariant
            ? {
                materialDescription: item.product.materialDescription,
                unit: item.product.unit || "NUM",
                specification: item.product.specification,
              }
            : {}),
          gstRate: item.product.gstRate,
          ...(saveSellingPricesToCatalog && item.spSnapshot > 0 ? { sellingPrice: nextSp } : {}),
          ...(saveSellingPricesToCatalog && item.cpSnapshot && item.cpSnapshot > 0
            ? { costPrice: nextCp }
            : {}),
        },
      })
      item.product.id = updated.id

      if (priceChanged) {
        if (
          existing._count.priceHistory === 0 &&
          (existing.costPrice > 0 || existing.sellingPrice > 0)
        ) {
          await prisma.priceHistory.create({
            data: {
              productId: existing.id,
              costPrice: existing.costPrice,
              sellingPrice: existing.sellingPrice,
              changedAt: existing.createdAt,
            },
          })
        }

        await prisma.priceHistory.create({
          data: {
            productId: existing.id,
            costPrice: nextCp,
            sellingPrice: nextSp,
          },
        })
      }
    }
  }
}

export async function createQuotation(data: {
  clientId: string
  prNo?: string
  rfqNo?: string
  status: string // DRAFT or PENDING
  saveSellingPricesToCatalog?: boolean
  items: QuotationItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (data.items.length === 0) {
      return { error: "Quotation must have at least one item" }
    }

    let totalAmount = 0
    let totalGst = 0

    for (const item of data.items) {
      if (item.isConfirmed === false) continue
      const amount = Math.round(item.quantity * item.spSnapshot)
      const gst = Math.round(amount * (item.product.gstRate / 100))

      totalAmount += amount
      totalGst += gst
    }

    await syncProductsAndPriceHistory(data.items, data.saveSellingPricesToCatalog ?? true)

    const id = await generateSmartQuotationId(data.clientId)

    const quotation = await prisma.quotation.create({
      data: {
        id,
        clientId: data.clientId,
        prNo: data.prNo || null,
        rfqNo: data.rfqNo || null,
        status: data.status,
        totalAmount,
        totalGst,
        items: {
          create: data.items.map((item, index) => ({
            id: `${id}-item-${index + 1}`,
            productId: item.product.id,
            itemDescription: item.product.materialDescription || null,
            itemSpecification: item.product.specification || null,
            itemUnit: item.product.unit || null,
            quantity: item.quantity,
            quotedQuantity: item.quotedQuantity ?? item.quantity,
            isConfirmed: item.isConfirmed ?? true,
            spSnapshot: item.spSnapshot,
            cpSnapshot: item.cpSnapshot || null,
            commissionCpSnapshot: item.commissionCpSnapshot || null,
            gstSnapshot: item.product.gstRate,
            supplierId: item.supplierId || null,
            comment: item.comment || null,
            leadTime: item.leadTime || null,
            additionalCost: item.additionalCost || 0,
          })),
        },
      },
    })

    revalidatePath("/quotations")
    revalidatePath("/products")
    return { success: true, id: quotation.id }
  } catch (error: any) {
    console.error("Create Quotation Error:", error)
    return { error: error.message || "Failed to create quotation" }
  }
}

export async function upsertDraftQuotation(data: {
  id?: string
  clientId: string
  prNo?: string
  rfqNo?: string
  status?: string
  expectedUpdatedAt?: Date
  saveSellingPricesToCatalog?: boolean
  items: QuotationItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (data.id && data.expectedUpdatedAt) {
      const current = await prisma.quotation.findUnique({
        where: { id: data.id },
        select: { updatedAt: true },
      })

      if (current && current.updatedAt.getTime() > new Date(data.expectedUpdatedAt).getTime()) {
        return {
          error:
            "CONFLICT: Someone else has updated this quotation since you opened it. Please refresh the page to see the latest changes.",
        }
      }
    }

    let totalAmount = 0
    let totalGst = 0

    for (const item of data.items) {
      if (item.isConfirmed === false) continue
      const amount = Math.round(item.quantity * item.spSnapshot)
      const gst = Math.round(amount * (item.product.gstRate / 100))

      totalAmount += amount
      totalGst += gst
    }

    let quotationId = data.id
    const finalStatus = data.status || "DRAFT"

    await syncProductsAndPriceHistory(data.items, data.saveSellingPricesToCatalog ?? true)

    if (!quotationId) {
      quotationId = await generateSmartQuotationId(data.clientId)

      await prisma.quotation.create({
        data: {
          id: quotationId,
          clientId: data.clientId,
          prNo: data.prNo || null,
          rfqNo: data.rfqNo || null,
          status: finalStatus,
          totalAmount,
          totalGst,
          items: {
            create: data.items.map((item, index) => ({
              id: `${quotationId}-item-${index + 1}`,
              productId: item.product.id,
              itemDescription: item.product.materialDescription || null,
              itemSpecification: item.product.specification || null,
              itemUnit: item.product.unit || null,
              quantity: item.quantity,
              quotedQuantity: item.quotedQuantity ?? item.quantity,
              isConfirmed: item.isConfirmed ?? true,
              spSnapshot: item.spSnapshot,
              cpSnapshot: item.cpSnapshot || null,
              commissionCpSnapshot: item.commissionCpSnapshot || null,
              gstSnapshot: item.product.gstRate,
              supplierId: item.supplierId || null,
              comment: item.comment || null,
              leadTime: item.leadTime || null,
              additionalCost: item.additionalCost || 0,
            })),
          },
        },
      })
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.quotationItem.deleteMany({
          where: { quotationId: quotationId },
        })

        await tx.quotation.update({
          where: { id: quotationId },
          data: {
            clientId: data.clientId,
            prNo: data.prNo || null,
            rfqNo: data.rfqNo || null,
            status: finalStatus,
            totalAmount,
            totalGst,
            items: {
              create: data.items.map((item, index) => ({
                id: `${quotationId}-item-${index + 1}-${Date.now().toString(36).slice(-3)}`,
                productId: item.product.id,
                itemDescription: item.product.materialDescription || null,
                itemSpecification: item.product.specification || null,
                itemUnit: item.product.unit || null,
                quantity: item.quantity,
                quotedQuantity: item.quotedQuantity ?? item.quantity,
                isConfirmed: item.isConfirmed ?? true,
                spSnapshot: item.spSnapshot,
                cpSnapshot: item.cpSnapshot || null,
                commissionCpSnapshot: item.commissionCpSnapshot || null,
                gstSnapshot: item.product.gstRate,
                supplierId: item.supplierId || null,
                comment: item.comment || null,
                leadTime: item.leadTime || null,
                additionalCost: item.additionalCost || 0,
              })),
            },
          },
        })
      })
    }

    revalidatePath("/quotations")
    revalidatePath(`/quotations/${quotationId}`)
    revalidatePath("/products")
    return { success: true, id: quotationId }
  } catch (error: any) {
    console.error("Upsert Draft Quotation Error:", error)
    return { error: error.message || "Failed to save draft" }
  }
}

export async function deleteQuotation(id: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    await prisma.quotation.delete({
      where: { id },
    })

    revalidatePath("/quotations")
    return { success: true }
  } catch (error: any) {
    console.error("Delete Quotation Error:", error)
    return { error: error.message || "Failed to delete quotation" }
  }
}

export async function updateQuotationStatus(id: string, newStatus: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    await prisma.quotation.update({
      where: { id },
      data: { status: newStatus },
    })

    revalidatePath("/quotations")
    revalidatePath(`/quotations/${id}`)
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Update Quotation Status Error:", error)
    return { error: error.message || "Failed to update quotation status" }
  }
}

export async function confirmQuotationOrder(data: {
  quotationId: string
  items: {
    itemId: string
    isConfirmed: boolean
    confirmedQuantity: number
  }[]
  splitUnconfirmedToNewQuote?: boolean
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const quotation = await prisma.quotation.findUnique({
      where: { id: data.quotationId },
      include: {
        items: {
          include: { product: true },
        },
      },
    })

    if (!quotation) return { error: "Quotation not found" }

    const itemMap = new Map(data.items.map((i) => [i.itemId, i]))
    const confirmedEntries = quotation.items.filter((qi) => {
      const sel = itemMap.get(qi.id)
      return sel ? sel.isConfirmed && sel.confirmedQuantity > 0 : qi.isConfirmed
    })

    if (confirmedEntries.length === 0) {
      return {
        error: "Please select at least one confirmed item with a quantity greater than 0.",
      }
    }

    let splitQuotationId: string | null = null

    if (data.splitUnconfirmedToNewQuote) {
      const unconfirmedToSplit: {
        original: (typeof quotation.items)[number]
        splitQty: number
      }[] = []

      for (const qi of quotation.items) {
        const sel = itemMap.get(qi.id)
        const origQty = qi.quotedQuantity ?? qi.quantity
        if (!sel || !sel.isConfirmed || sel.confirmedQuantity <= 0) {
          unconfirmedToSplit.push({ original: qi, splitQty: origQty })
        } else if (sel.confirmedQuantity < origQty) {
          const remainder = Number((origQty - sel.confirmedQuantity).toFixed(4))
          if (remainder > 0) {
            unconfirmedToSplit.push({ original: qi, splitQty: remainder })
          }
        }
      }

      if (unconfirmedToSplit.length > 0) {
        splitQuotationId = await generateSmartQuotationId(quotation.clientId)
        let splitTotalAmount = 0
        let splitTotalGst = 0
        for (const u of unconfirmedToSplit) {
          const amt = Math.round(u.splitQty * u.original.spSnapshot)
          const gst = Math.round(
            amt * ((u.original.gstSnapshot || u.original.product.gstRate) / 100)
          )
          splitTotalAmount += amt
          splitTotalGst += gst
        }

        await prisma.quotation.create({
          data: {
            id: splitQuotationId,
            clientId: quotation.clientId,
            prNo: quotation.prNo ? `${quotation.prNo} (Bal)` : null,
            rfqNo: quotation.rfqNo,
            status: "PENDING",
            totalAmount: splitTotalAmount,
            totalGst: splitTotalGst,
            items: {
              create: unconfirmedToSplit.map((u, idx) => ({
                id: `${splitQuotationId}-item-${idx + 1}`,
                productId: u.original.productId,
                itemDescription: u.original.itemDescription,
                itemSpecification: u.original.itemSpecification,
                itemUnit: u.original.itemUnit,
                quantity: u.splitQty,
                quotedQuantity: u.splitQty,
                isConfirmed: true,
                spSnapshot: u.original.spSnapshot,
                cpSnapshot: u.original.cpSnapshot,
                commissionCpSnapshot: u.original.commissionCpSnapshot,
                gstSnapshot: u.original.gstSnapshot,
                supplierId: u.original.supplierId,
                comment: u.original.comment,
                leadTime: u.original.leadTime,
                additionalCost: u.original.additionalCost || 0,
              })),
            },
          },
        })
      }
    }

    let newTotalAmount = 0
    let newTotalGst = 0

    await prisma.$transaction(async (tx) => {
      for (const qi of quotation.items) {
        const sel = itemMap.get(qi.id)
        const origQty = qi.quotedQuantity ?? qi.quantity
        const isConfirmed = sel ? sel.isConfirmed && sel.confirmedQuantity > 0 : qi.isConfirmed
        const finalQty = isConfirmed && sel ? sel.confirmedQuantity : qi.quantity

        if (data.splitUnconfirmedToNewQuote && !isConfirmed) {
          await tx.quotationItem.delete({ where: { id: qi.id } })
          continue
        }

        if (isConfirmed) {
          const amt = Math.round(finalQty * qi.spSnapshot)
          const gst = Math.round(amt * ((qi.gstSnapshot || qi.product.gstRate) / 100))
          newTotalAmount += amt
          newTotalGst += gst
        }

        await tx.quotationItem.update({
          where: { id: qi.id },
          data: {
            isConfirmed,
            quantity: finalQty,
            quotedQuantity: data.splitUnconfirmedToNewQuote ? finalQty : origQty,
          },
        })
      }

      const newGrandTotal = newTotalAmount + newTotalGst
      let nextPaymentStatus = quotation.paymentStatus
      if (quotation.amountPaid > 0) {
        nextPaymentStatus =
          quotation.amountPaid >= newGrandTotal ? "PAID" : "PARTIALLY_PAID"
      }

      await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          status: "ACCEPTED",
          totalAmount: newTotalAmount,
          totalGst: newTotalGst,
          paymentStatus: nextPaymentStatus,
        },
      })
    })

    revalidatePath("/quotations")
    revalidatePath(`/quotations/${quotation.id}`)
    if (splitQuotationId) revalidatePath(`/quotations/${splitQuotationId}`)
    revalidatePath("/purchase-orders")
    revalidatePath("/quotation-dues")
    revalidatePath("/accounts")
    revalidatePath("/")

    return {
      success: true,
      confirmedCount: confirmedEntries.length,
      totalCount: quotation.items.length,
      splitQuotationId,
    }
  } catch (error: any) {
    console.error("Confirm Quotation Order Error:", error)
    return { error: error.message || "Failed to confirm order items" }
  }
}

export async function getQuotationsForImport() {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const quotations = await prisma.quotation.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        client: { select: { name: true } },
        prNo: true,
        items: {
          select: {
            id: true,
            quantity: true,
            comment: true,
            itemDescription: true,
            itemSpecification: true,
            itemUnit: true,
            product: {
              select: {
                id: true,
                materialCode: true,
                materialDescription: true,
                sellingPrice: true,
                costPrice: true,
                gstRate: true,
                unit: true,
                specification: true,
              },
            },
          },
        },
      },
    })
    return {
      success: true,
      quotations: quotations.map((q) => ({
        ...q,
        items: q.items.map((i) => ({
          ...i,
          product: {
            ...i.product,
            materialDescription: i.itemDescription || i.product.materialDescription,
            specification: i.itemSpecification ?? i.product.specification,
            unit: i.itemUnit || i.product.unit,
          },
        })),
      })),
    }
  } catch {
    return { error: "Failed to fetch quotations" }
  }
}
