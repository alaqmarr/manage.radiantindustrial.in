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

    let totalAmount = 0
    let totalGst = 0
    
    for (const item of data.items) {
      const amount = Math.round(item.quantity * item.unitPrice)
      const gst = Math.round(amount * (item.gstRate / 100))
      totalAmount += amount
      totalGst += gst
    }

    // Upsert products
    for (const item of data.items) {
      const p = await prisma.product.upsert({
        where: { materialCode: item.product.materialCode },
        update: {
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.gstRate
        },
        create: {
          id: generateSlug(`${item.product.materialCode} ${item.product.materialDescription}`, true),
          materialCode: item.product.materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.gstRate,
          costPrice: 0,
          sellingPrice: 0
        }
      })
      item.product.id = p.id
      
      // Update supplier product linkage (cost price)
      await prisma.productSupplier.upsert({
        where: { productId_supplierId: { productId: p.id, supplierId: data.supplierId } },
        update: { costPrice: item.unitPrice },
        create: { productId: p.id, supplierId: data.supplierId, costPrice: item.unitPrice }
      })
    }

        const lastPo = await prisma.purchaseOrder.findFirst({
      orderBy: { poNumber: 'desc' },
      select: { poNumber: true }
    });
    let nextNum = 1;
    if (lastPo && lastPo.poNumber) {
      const match = lastPo.poNumber.match(/PO-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const id = generateSlug(`PO-${Date.now()}-${nextNum}`);
    const poNumber = `PO-${String(nextNum).padStart(6, '0')}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        id,
        poNumber,
        supplierId: data.supplierId,
        rfqId: data.rfqId,
        status: data.status || "DRAFT",
        paymentTerms: data.paymentTerms,
        deliveryTerms: data.deliveryTerms,
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        notes: data.notes,
        totalAmount,
        totalGst,
        items: {
          create: data.items.map((item: any, index: number) => ({
            id: generateSlug(`POI-${id}-${index}`),
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            comment: item.comment || null
          }))
        }
      }
    })

    if (data.rfqId) {
       await prisma.rfq.update({
         where: { id: data.rfqId },
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

    let totalAmount = 0
    let totalGst = 0
    
    for (const item of data.items) {
      const amount = Math.round(item.quantity * item.unitPrice)
      const gst = Math.round(amount * (item.gstRate / 100))
      totalAmount += amount
      totalGst += gst
    }

    // Upsert products
    for (const item of data.items) {
      const p = await prisma.product.upsert({
        where: { materialCode: item.product.materialCode },
        update: {
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.gstRate
        },
        create: {
          id: generateSlug(`${item.product.materialCode} `, true),
          materialCode: item.product.materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.gstRate,
          costPrice: 0,
          sellingPrice: 0
        }
      })
      item.product.id = p.id
    }

    const po = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.purchaseOrderItem.deleteMany({
        where: { poId: id }
      })

      return await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          rfqId: data.rfqId,
          status: data.status || 'DRAFT',
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
          notes: data.notes,
          totalAmount,
          totalGst,
          items: {
            create: data.items.map((item: any, index: number) => ({
              id: generateSlug(`POI-${id}-${index}`),
              productId: item.product.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              comment: item.comment || null
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
