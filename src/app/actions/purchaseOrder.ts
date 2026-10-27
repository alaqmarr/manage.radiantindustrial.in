"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"

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
      select: { id: true }
    })
    if (!supplier) return { error: "Selected supplier does not exist" }

    let validRfqId: string | null = null
    if (data.rfqId && data.rfqId.trim()) {
      const trimmedRfqId = data.rfqId.trim()
      const existingRfq = await prisma.rfq.findUnique({
        where: { id: trimmedRfqId },
        select: { id: true }
      }) || await prisma.rfq.findFirst({
        where: { id: { contains: trimmedRfqId } },
        select: { id: true }
      })
      if (existingRfq) {
        validRfqId = existingRfq.id
      }
    }

    let validQuotationId: string | null = null
    if (data.quotationId && data.quotationId.trim()) {
      const existingQuotation = await prisma.quotation.findUnique({
        where: { id: data.quotationId.trim() },
        select: { id: true }
      })
      if (existingQuotation) {
        validQuotationId = existingQuotation.id
      }
    }

    let totalAmount = 0
    let totalGst = 0
    
    for (const item of data.items) {
      const amount = Math.round(item.quantity * item.unitPrice)
      const gst = Math.round(amount * (item.gstRate / 100))
      totalAmount += amount
      totalGst += gst
    }

    // Upsert products
    const resolvedItems: {
      productId: string
      quantity: number
      unitPrice: number
      gstRate: number
      comment: string | null
    }[] = []

    for (const item of data.items) {
      const materialCode = (item.product.materialCode || "").trim() || `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const p = await prisma.product.upsert({
        where: { materialCode },
        update: {
          materialDescription: item.product.materialDescription,
          unit: item.product.unit || "NUM",
          gstRate: item.gstRate
        },
        create: {
          id: generateSlug(`${materialCode} ${item.product.materialDescription}`, true),
          materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit || "NUM",
          gstRate: item.gstRate,
          costPrice: 0,
          sellingPrice: 0
        }
      })
      
      // Update supplier product linkage (cost price)
      await prisma.productSupplier.upsert({
        where: { productId_supplierId: { productId: p.id, supplierId: supplier.id } },
        update: { costPrice: item.unitPrice },
        create: { productId: p.id, supplierId: supplier.id, costPrice: item.unitPrice }
      })

      resolvedItems.push({
        productId: p.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        comment: item.comment || null
      })
    }

    const allPos = await prisma.purchaseOrder.findMany({
      where: { poNumber: { startsWith: 'PO-' } },
      select: { poNumber: true }
    });
    let maxNum = 0;
    for (const p of allPos) {
      if (p.poNumber) {
        const match = p.poNumber.match(/^PO-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    const nextNum = maxNum + 1;
    const id = generateSlug(`PO-${Date.now()}-${nextNum}`);
    let poNumber = data.poNumber?.trim() || `PO-${String(nextNum).padStart(6, '0')}`;

    const existingWithPoNum = await prisma.purchaseOrder.findUnique({
      where: { poNumber },
      select: { id: true }
    });
    if (existingWithPoNum) {
      if (data.poNumber?.trim()) {
        return { error: `PO Number "${poNumber}" already exists. Please use a different PO Number.` };
      }
      poNumber = `PO-${Date.now()}`;
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
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        notes: data.notes,
        totalAmount,
        totalGst,
        items: {
          create: resolvedItems.map((item, index) => ({
            id: generateSlug(`POI-${id}-${index}`, true),
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            comment: item.comment
          }))
        }
      }
    })

    if (validRfqId) {
       await prisma.rfq.update({
         where: { id: validRfqId },
         data: { status: "COMPLETED" }
       })
    }

    revalidatePath("/purchase-orders")
    return { success: true, id: po.id }
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
      data: { status: newStatus }
    })
    revalidatePath("/purchase-orders")
    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to update PO status" }
  }
}

export async function updatePurchaseOrder(id: string, data: any) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    if (data.items.length === 0) return { error: 'PO must have at least one item' }

    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true }
    })
    if (!supplier) return { error: 'Selected supplier does not exist' }

    let validRfqId: string | null = null
    if (data.rfqId && data.rfqId.trim()) {
      const trimmedRfqId = data.rfqId.trim()
      const existingRfq = await prisma.rfq.findUnique({
        where: { id: trimmedRfqId },
        select: { id: true }
      }) || await prisma.rfq.findFirst({
        where: { id: { contains: trimmedRfqId } },
        select: { id: true }
      })
      if (existingRfq) {
        validRfqId = existingRfq.id
      }
    }

    let validQuotationId: string | null = null
    if (data.quotationId && data.quotationId.trim()) {
      const existingQuotation = await prisma.quotation.findUnique({
        where: { id: data.quotationId.trim() },
        select: { id: true }
      })
      if (existingQuotation) {
        validQuotationId = existingQuotation.id
      }
    }

    let totalAmount = 0
    let totalGst = 0
    
    for (const item of data.items) {
      const amount = Math.round(item.quantity * item.unitPrice)
      const gst = Math.round(amount * (item.gstRate / 100))
      totalAmount += amount
      totalGst += gst
    }

    // Upsert products
    const resolvedItems: {
      productId: string
      quantity: number
      unitPrice: number
      gstRate: number
      comment: string | null
    }[] = []

    for (const item of data.items) {
      const materialCode = (item.product.materialCode || "").trim() || `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const p = await prisma.product.upsert({
        where: { materialCode },
        update: {
          materialDescription: item.product.materialDescription,
          unit: item.product.unit || "NUM",
          gstRate: item.gstRate
        },
        create: {
          id: generateSlug(`${materialCode} ${item.product.materialDescription}`, true),
          materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit || "NUM",
          gstRate: item.gstRate,
          costPrice: 0,
          sellingPrice: 0
        }
      })

      await prisma.productSupplier.upsert({
        where: { productId_supplierId: { productId: p.id, supplierId: supplier.id } },
        update: { costPrice: item.unitPrice },
        create: { productId: p.id, supplierId: supplier.id, costPrice: item.unitPrice }
      })

      resolvedItems.push({
        productId: p.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        comment: item.comment || null
      })
    }

    const po = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.purchaseOrderItem.deleteMany({
        where: { poId: id }
      })

      return await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: supplier.id,
          rfqId: validRfqId,
          quotationId: validQuotationId,
          ...(data.poNumber?.trim() ? { poNumber: data.poNumber.trim() } : {}),
          status: data.status || 'DRAFT',
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
          notes: data.notes,
          totalAmount,
          totalGst,
          items: {
            create: resolvedItems.map((item, index) => ({
              id: generateSlug(`POI-${id}-${index}`, true),
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              comment: item.comment
            }))
          }
        }
      })
    })

    revalidatePath('/purchase-orders')
    return { success: true, id: po.id }
  } catch (error: any) {
    console.error('Update PO Error:', error)
    return { error: error.message || 'Failed to update PO' }
  }
}
