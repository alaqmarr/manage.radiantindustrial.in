"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"
import { generateSmartPoId } from "@/lib/smartId"

type POItemData = {
  product: {
    id: string
    materialCode: string
    materialDescription: string
    unit: string
    gstRate: number
  }
  quantity: number
  unitPrice: number // paise
  gstRate: number
  comment?: string
}

async function checkDuplicatePoForQuotation(
  quotationId: string,
  supplierId: string,
  resolvedItems: {
    productId: string
    quantity: number
    materialCode: string
    materialDescription: string
    unit: string
  }[],
  excludePoId?: string
): Promise<string | null> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      items: {
        include: { product: true },
      },
      purchaseOrders: {
        where: {
          status: { not: "CANCELLED" },
          ...(excludePoId ? { id: { not: excludePoId } } : {}),
        },
        include: {
          items: true,
          supplier: { select: { name: true } },
        },
      },
      purchases: {
        include: {
          items: true,
          supplier: { select: { name: true } },
        },
      },
    },
  })

  if (!quotation) return null

  // Group requested quantities by productId so multiple variants of the same product in one PO work properly
  const requestedByProduct = new Map<
    string,
    {
      totalRequestedQty: number
      materialCode: string
      materialDescription: string
      unit: string
    }
  >()
  for (const item of resolvedItems) {
    const existing = requestedByProduct.get(item.productId)
    if (existing) {
      existing.totalRequestedQty += item.quantity
    } else {
      requestedByProduct.set(item.productId, {
        totalRequestedQty: item.quantity,
        materialCode: item.materialCode,
        materialDescription: item.materialDescription,
        unit: item.unit,
      })
    }
  }

  for (const [productId, req] of requestedByProduct.entries()) {
    const existingPosForProduct = quotation.purchaseOrders.filter((po) =>
      po.items.some((pi) => pi.productId === productId)
    )
    const existingPurchasesForProduct = quotation.purchases.filter((pur) =>
      pur.items.some((pi) => pi.productId === productId)
    )

    if (existingPosForProduct.length === 0 && existingPurchasesForProduct.length === 0) continue

    const alreadyOrderedViaPoQty = existingPosForProduct.reduce((sum, po) => {
      const poItemsForProd = po.items.filter((pi) => pi.productId === productId)
      return sum + poItemsForProd.reduce((s, pi) => s + (pi.quantity || 0), 0)
    }, 0)

    const alreadyBoughtViaDirectQty = existingPurchasesForProduct.reduce((sum, pur) => {
      const purItemsForProd = pur.items.filter((pi) => pi.productId === productId)
      return sum + purItemsForProd.reduce((s, pi) => s + (pi.quantity || 0), 0)
    }, 0)

    const alreadyOrderedQty = alreadyOrderedViaPoQty + alreadyBoughtViaDirectQty

    const matchingQItems = quotation.items.filter((qi) => qi.productId === productId)
    const confirmedQItems = matchingQItems.filter((qi) => qi.isConfirmed !== false)

    if (matchingQItems.length > 0 && confirmedQItems.length === 0) {
      return `Item "${req.materialCode} - ${req.materialDescription}" was marked as Not Ordered by the client in this quotation.`
    }

    const totalConfirmedQuotedQty = confirmedQItems.reduce((s, qi) => s + qi.quantity, 0)

    const sourceLabels = [
      ...existingPosForProduct.map(
        (po) => `PO ${po.poNumber || po.id.toUpperCase()} (${po.supplier.name})`
      ),
      ...existingPurchasesForProduct.map(
        (pur) => `Direct Purchase #${pur.id.toUpperCase()} (${pur.supplier.name})`
      ),
    ].join(", ")

    if (confirmedQItems.length > 0) {
      if (alreadyOrderedQty >= totalConfirmedQuotedQty) {
        return `Duplicate order prevented: "${req.materialCode} - ${req.materialDescription}" is already fully procured (${alreadyOrderedQty}/${totalConfirmedQuotedQty} ${req.unit}) for this quotation under ${sourceLabels}.`
      }
      if (alreadyOrderedQty + req.totalRequestedQty > totalConfirmedQuotedQty) {
        const remaining = Math.max(0, totalConfirmedQuotedQty - alreadyOrderedQty)
        return `Order quantity exceeded for "${req.materialCode}": ${alreadyOrderedQty} of ${totalConfirmedQuotedQty} ${req.unit} is already procured under ${sourceLabels}. Only ${remaining} ${req.unit} remaining.`
      }
    } else {
      const sameSupplierPo = existingPosForProduct.find((po) => po.supplierId === supplierId)
      const sameSupplierPurchase = existingPurchasesForProduct.find(
        (pur) => pur.supplierId === supplierId
      )
      if (sameSupplierPo || sameSupplierPurchase) {
        return `Duplicate order prevented: "${req.materialCode} - ${req.materialDescription}" is already procured from this supplier under ${sourceLabels} for this quotation.`
      }
    }
  }

  return null
}

export async function createPurchaseOrder(data: {
  supplierId: string
  rfqId?: string
  quotationId?: string
  poNumber?: string
  status: string
  paymentTerms?: string
  deliveryTerms?: string
  expectedDeliveryDate?: string
  notes?: string
  items: POItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    if (data.items.length === 0) return { error: "PO must have at least one item" }

    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, name: true },
    })
    if (!supplier) return { error: "Selected supplier does not exist" }

    let validRfqId: string | null = null
    if (data.rfqId && data.rfqId.trim()) {
      const trimmedRfqId = data.rfqId.trim()
      const existingRfq =
        (await prisma.rfq.findUnique({
          where: { id: trimmedRfqId },
          select: { id: true },
        })) ||
        (await prisma.rfq.findFirst({
          where: { id: { contains: trimmedRfqId } },
          select: { id: true },
        }))
      if (existingRfq) {
        validRfqId = existingRfq.id
      }
    }

    let validQuotationId: string | null = null
    if (data.quotationId && data.quotationId.trim()) {
      const existingQuotation = await prisma.quotation.findUnique({
        where: { id: data.quotationId.trim() },
        select: { id: true },
      })
      if (existingQuotation) {
        validQuotationId = existingQuotation.id
      }
    }

    let totalAmount = 0
    let totalGst = 0

    const codeCounts = new Map<string, number>()
    for (const item of data.items) {
      const amount = Math.round(item.quantity * item.unitPrice)
      const gst = Math.round(amount * (item.gstRate / 100))
      totalAmount += amount
      totalGst += gst
      const code = (item.product.materialCode || "").trim().toUpperCase()
      if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
    }

    // Upsert products
    const resolvedItems: {
      productId: string
      materialCode: string
      materialDescription: string
      unit: string
      quantity: number
      unitPrice: number
      gstRate: number
      comment: string | null
    }[] = []

    for (const item of data.items) {
      const materialCode =
        (item.product.materialCode || "").trim() ||
        `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const isMultiVariant = (codeCounts.get(materialCode.toUpperCase()) || 0) > 1

      const p = await prisma.product.upsert({
        where: { materialCode },
        update: {
          ...(!isMultiVariant ? { materialDescription: item.product.materialDescription } : {}),
          unit: item.product.unit || "NUM",
          gstRate: item.gstRate,
        },
        create: {
          id: generateSlug(`${materialCode} ${item.product.materialDescription}`, true),
          materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit || "NUM",
          gstRate: item.gstRate,
          costPrice: item.unitPrice || 0,
          sellingPrice: 0,
        },
      })

      resolvedItems.push({
        productId: p.id,
        materialCode: p.materialCode,
        materialDescription: item.product.materialDescription || p.materialDescription,
        unit: item.product.unit || p.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        comment: item.comment || null,
      })
    }

    // Prevent duplicate POs for the same Quotation
    if (validQuotationId) {
      const dupError = await checkDuplicatePoForQuotation(
        validQuotationId,
        supplier.id,
        resolvedItems
      )
      if (dupError) {
        return { error: dupError }
      }
    }

    // Update supplier product linkage (cost price)
    for (const item of resolvedItems) {
      await prisma.productSupplier.upsert({
        where: { productId_supplierId: { productId: item.productId, supplierId: supplier.id } },
        update: { costPrice: item.unitPrice },
        create: { productId: item.productId, supplierId: supplier.id, costPrice: item.unitPrice },
      })
    }

    const smartPo = await generateSmartPoId(supplier.id)
    const id = smartPo.id
    const poNumber = data.poNumber?.trim() || smartPo.poNumber

    if (data.poNumber?.trim()) {
      const existingWithPoNum = await prisma.purchaseOrder.findUnique({
        where: { poNumber },
        select: { id: true },
      })
      if (existingWithPoNum) {
        return {
          error: `PO Number "${poNumber}" already exists. Please use a different PO Number.`,
        }
      }
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        id,
        poNumber,
        supplierId: supplier.id,
        rfqId: validRfqId,
        quotationId: validQuotationId,
        status: data.status || "DRAFT",
        paymentTerms: data.paymentTerms,
        deliveryTerms: data.deliveryTerms,
        expectedDeliveryDate: data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : null,
        notes: data.notes,
        totalAmount,
        totalGst,
        items: {
          create: resolvedItems.map((item, index) => ({
            id: `${id}-item-${index + 1}`,
            productId: item.productId,
            itemDescription: item.materialDescription || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            comment: item.comment,
          })),
        },
      },
    })

    if (validRfqId) {
      await prisma.rfq.update({
        where: { id: validRfqId },
        data: { status: "COMPLETED" },
      })
    }

    revalidatePath("/purchase-orders")
    if (validQuotationId) {
      revalidatePath(`/quotations/${validQuotationId}`)
      revalidatePath("/quotations")
    }
    return { success: true, id: po.id, poNumber: po.poNumber }
  } catch (error: any) {
    console.error("Create PO Error:", error)
    return { error: error.message || "Failed to create PO" }
  }
}

export async function deletePurchaseOrder(id: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    await prisma.purchaseOrder.delete({ where: { id } })
    revalidatePath("/purchase-orders")
    revalidatePath("/quotations")
    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to delete PO" }
  }
}

export async function updatePurchaseOrderStatus(id: string, newStatus: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: newStatus },
    })
    revalidatePath("/purchase-orders")
    revalidatePath("/quotations")
    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to update PO status" }
  }
}

export async function updatePurchaseOrder(id: string, data: any) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    if (data.items.length === 0) return { error: "PO must have at least one item" }

    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true },
    })
    if (!supplier) return { error: "Selected supplier does not exist" }

    let validRfqId: string | null = null
    if (data.rfqId && data.rfqId.trim()) {
      const trimmedRfqId = data.rfqId.trim()
      const existingRfq =
        (await prisma.rfq.findUnique({
          where: { id: trimmedRfqId },
          select: { id: true },
        })) ||
        (await prisma.rfq.findFirst({
          where: { id: { contains: trimmedRfqId } },
          select: { id: true },
        }))
      if (existingRfq) {
        validRfqId = existingRfq.id
      }
    }

    let validQuotationId: string | null = null
    if (data.quotationId && data.quotationId.trim()) {
      const existingQuotation = await prisma.quotation.findUnique({
        where: { id: data.quotationId.trim() },
        select: { id: true },
      })
      if (existingQuotation) {
        validQuotationId = existingQuotation.id
      }
    }

    let totalAmount = 0
    let totalGst = 0

    const codeCounts = new Map<string, number>()
    for (const item of data.items) {
      const amount = Math.round(item.quantity * item.unitPrice)
      const gst = Math.round(amount * (item.gstRate / 100))
      totalAmount += amount
      totalGst += gst
      const code = (item.product.materialCode || "").trim().toUpperCase()
      if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
    }

    // Upsert products
    const resolvedItems: {
      productId: string
      materialCode: string
      materialDescription: string
      unit: string
      quantity: number
      unitPrice: number
      gstRate: number
      comment: string | null
    }[] = []

    for (const item of data.items) {
      const materialCode =
        (item.product.materialCode || "").trim() ||
        `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const isMultiVariant = (codeCounts.get(materialCode.toUpperCase()) || 0) > 1

      const p = await prisma.product.upsert({
        where: { materialCode },
        update: {
          ...(!isMultiVariant ? { materialDescription: item.product.materialDescription } : {}),
          unit: item.product.unit || "NUM",
          gstRate: item.gstRate,
        },
        create: {
          id: generateSlug(`${materialCode} ${item.product.materialDescription}`, true),
          materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit || "NUM",
          gstRate: item.gstRate,
          costPrice: item.unitPrice || 0,
          sellingPrice: 0,
        },
      })

      resolvedItems.push({
        productId: p.id,
        materialCode: p.materialCode,
        materialDescription: item.product.materialDescription || p.materialDescription,
        unit: item.product.unit || p.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        comment: item.comment || null,
      })
    }

    if (validQuotationId) {
      const dupError = await checkDuplicatePoForQuotation(
        validQuotationId,
        supplier.id,
        resolvedItems,
        id
      )
      if (dupError) {
        return { error: dupError }
      }
    }

    for (const item of resolvedItems) {
      await prisma.productSupplier.upsert({
        where: { productId_supplierId: { productId: item.productId, supplierId: supplier.id } },
        update: { costPrice: item.unitPrice },
        create: { productId: item.productId, supplierId: supplier.id, costPrice: item.unitPrice },
      })
    }

    const po = await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({
        where: { poId: id },
      })

      return await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: supplier.id,
          rfqId: validRfqId,
          quotationId: validQuotationId,
          ...(data.poNumber?.trim() ? { poNumber: data.poNumber.trim() } : {}),
          status: data.status || "DRAFT",
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate)
            : null,
          notes: data.notes,
          totalAmount,
          totalGst,
          items: {
            create: resolvedItems.map((item, index) => ({
              id: generateSlug(`POI-${id}-${index}`, true),
              productId: item.productId,
              itemDescription: item.materialDescription || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              comment: item.comment,
            })),
          },
        },
      })
    })

    revalidatePath("/purchase-orders")
    if (validQuotationId) {
      revalidatePath(`/quotations/${validQuotationId}`)
      revalidatePath("/quotations")
    }
    return { success: true, id: po.id }
  } catch (error: any) {
    console.error("Update PO Error:", error)
    return { error: error.message || "Failed to update PO" }
  }
}

export async function createBatchPurchaseOrdersFromQuotation(data: {
  quotationId: string
  status?: "DRAFT" | "ISSUED"
  paymentTerms?: string
  deliveryTerms?: string
  expectedDeliveryDate?: string
  notes?: string
  groups: {
    supplierId: string
    items: {
      productId: string
      itemDescription?: string | null
      quantity: number
      unitPrice: number // paise
      gstRate: number
      comment?: string
    }[]
  }[]
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    if (!data.quotationId || !data.quotationId.trim()) {
      return { error: "Quotation ID is required" }
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: data.quotationId.trim() },
      include: {
        items: {
          include: { product: true },
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

    if (!quotation) {
      return { error: "Quotation not found" }
    }

    // Merge items by supplierId across groups and filter valid items (quantity > 0)
    const mergedBySupplier = new Map<
      string,
      {
        productId: string
        itemDescription?: string | null
        quantity: number
        unitPrice: number
        gstRate: number
        comment?: string
      }[]
    >()

    for (const group of data.groups || []) {
      const supId = (group.supplierId || "").trim()
      if (!supId) continue
      const validItems = (group.items || []).filter(
        (it) => it.productId && Number(it.quantity) > 0
      )
      if (validItems.length === 0) continue

      const existing = mergedBySupplier.get(supId) || []
      existing.push(
        ...validItems.map((it) => ({
          productId: it.productId,
          itemDescription: it.itemDescription || null,
          quantity: Number(it.quantity),
          unitPrice: Math.max(0, Math.round(Number(it.unitPrice) || 0)),
          gstRate: Number(it.gstRate) || 0,
          comment: it.comment || undefined,
        }))
      )
      mergedBySupplier.set(supId, existing)
    }

    if (mergedBySupplier.size === 0) {
      return {
        error: "Please assign a vendor and valid quantity (> 0) for at least one item.",
      }
    }

    // Verify all selected suppliers exist
    const supplierIds = Array.from(mergedBySupplier.keys())
    const existingSuppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true },
    })
    const supplierMap = new Map(existingSuppliers.map((s) => [s.id, s]))

    for (const supId of supplierIds) {
      if (!supplierMap.has(supId)) {
        return { error: `Selected supplier (${supId}) does not exist.` }
      }
    }

    // Validate that total requested quantities across all groups do not exceed remaining quotation quantities
    const allBatchItems: {
      productId: string
      quantity: number
      materialCode: string
      materialDescription: string
      unit: string
    }[] = []

    const productLookup = new Map(
      quotation.items.map((qi) => [qi.productId, qi.product])
    )

    for (const items of mergedBySupplier.values()) {
      for (const item of items) {
        const prod = productLookup.get(item.productId)
        allBatchItems.push({
          productId: item.productId,
          quantity: item.quantity,
          materialCode: prod?.materialCode || item.productId,
          materialDescription:
            item.itemDescription || prod?.materialDescription || "",
          unit: prod?.unit || "NUM",
        })
      }
    }

    const dupError = await checkDuplicatePoForQuotation(
      quotation.id,
      supplierIds[0],
      allBatchItems
    )
    if (dupError) {
      return { error: dupError }
    }

    const poStatus = data.status === "DRAFT" ? "DRAFT" : "ISSUED"
    const createdPoIds: string[] = []
    const createdPoNumbers: string[] = []

    for (const [supplierId, items] of mergedBySupplier.entries()) {
      let totalAmount = 0
      let totalGst = 0

      for (const item of items) {
        const amount = Math.round(item.quantity * item.unitPrice)
        const gst = Math.round(amount * (item.gstRate / 100))
        totalAmount += amount
        totalGst += gst
      }

      const smartPo = await generateSmartPoId(supplierId)
      const id = smartPo.id
      const poNumber = smartPo.poNumber

      const po = await prisma.purchaseOrder.create({
        data: {
          id,
          poNumber,
          supplierId,
          quotationId: quotation.id,
          status: poStatus,
          paymentTerms: data.paymentTerms || undefined,
          deliveryTerms: data.deliveryTerms || undefined,
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate)
            : null,
          notes: data.notes || undefined,
          totalAmount,
          totalGst,
          items: {
            create: items.map((item, idx) => ({
              id: `${id}-item-${idx + 1}`,
              productId: item.productId,
              itemDescription: item.itemDescription || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              comment: item.comment || null,
            })),
          },
        },
      })

      createdPoIds.push(po.id)
      createdPoNumbers.push(po.poNumber || po.id.toUpperCase())

      // Update ProductSupplier costPrice for each ordered item
      for (const item of items) {
        if (item.unitPrice > 0) {
          await prisma.productSupplier.upsert({
            where: {
              productId_supplierId: {
                productId: item.productId,
                supplierId,
              },
            },
            update: { costPrice: item.unitPrice },
            create: {
              productId: item.productId,
              supplierId,
              costPrice: item.unitPrice,
            },
          })
        }
      }
    }

    revalidatePath("/purchase-orders")
    revalidatePath("/quotations")
    revalidatePath(`/quotations/${quotation.id}`)

    return {
      success: true,
      createdPoIds,
      createdPoNumbers,
      count: createdPoIds.length,
    }
  } catch (error: any) {
    console.error("Batch Create PO Error:", error)
    return { error: error.message || "Failed to generate vendor Purchase Orders" }
  }
}
