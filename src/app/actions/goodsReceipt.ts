"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function createGoodsReceipt(data: {
  poId: string
  grnNumber?: string
  notes?: string
  items: { productId: string; quantityReceived: number }[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!data.poId) {
      return { error: "Purchase Order ID is required" }
    }

    // Create GoodsReceipt and GoodsReceiptItems in a transaction
    const grn = await prisma.$transaction(async (tx) => {
      // Fetch the PO with items and existing deliveries
      const po = await tx.purchaseOrder.findUnique({
        where: { id: data.poId },
        include: {
          items: {
            include: { product: true }
          },
          deliveries: {
            include: { items: true }
          }
        }
      })

      if (!po) {
        throw new Error("Purchase Order not found")
      }

      // For each item, calculate already-received qty from all existing GRN items
      const receivedMap = new Map<string, number>()
      for (const delivery of po.deliveries) {
        for (const item of delivery.items) {
          receivedMap.set(
            item.productId,
            (receivedMap.get(item.productId) || 0) + item.quantityReceived
          )
        }
      }

      // Validate: new quantityReceived + already received <= ordered quantity for each item
      const itemsToReceive = data.items.filter((i) => i.quantityReceived > 0)
      if (itemsToReceive.length === 0) {
        throw new Error("At least one item must have a received quantity greater than 0")
      }

      for (const item of data.items) {
        if (item.quantityReceived < 0) {
          throw new Error("Received quantity cannot be negative")
        }

        const poItem = po.items.find((pi) => pi.productId === item.productId)
        if (!poItem) {
          throw new Error("Product not found in Purchase Order items")
        }

        const alreadyReceived = receivedMap.get(item.productId) || 0
        if (alreadyReceived + item.quantityReceived > poItem.quantity) {
          throw new Error(`Received quantity exceeds ordered quantity for ${poItem.product.materialCode} (Ordered: ${poItem.quantity}, Already Received: ${alreadyReceived}, Attempting to Receive: ${item.quantityReceived})`)
        }
      }

      // Auto-generate grnNumber if not provided: GRN-${Date.now().toString(36).toUpperCase()}
      const grnNumber = data.grnNumber?.trim() || `GRN-${Date.now().toString(36).toUpperCase()}`

      const newGrn = await tx.goodsReceipt.create({
        data: {
          poId: data.poId,
          grnNumber,
          notes: data.notes?.trim() || null,
          items: {
            create: itemsToReceive.map((item) => ({
              productId: item.productId,
              quantityReceived: item.quantityReceived
            }))
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      })

      // After creating, check if ALL PO items are fully delivered. If yes, update PO status to 'COMPLETED'
      const updatedReceivedMap = new Map<string, number>(receivedMap)
      for (const item of itemsToReceive) {
        updatedReceivedMap.set(
          item.productId,
          (updatedReceivedMap.get(item.productId) || 0) + item.quantityReceived
        )
      }

      const isAllFullyDelivered =
        po.items.length > 0 &&
        po.items.every((pi) => {
          const totalReceived = updatedReceivedMap.get(pi.productId) || 0
          return totalReceived >= pi.quantity
        })

      if (isAllFullyDelivered) {
        await tx.purchaseOrder.update({
          where: { id: data.poId },
          data: { status: "COMPLETED" }
        })
      }

      return newGrn
    })

    revalidatePath("/purchase-orders")
    revalidatePath(`/purchase-orders/${data.poId}`)

    return { success: true, grn }
  } catch (error: any) {
    console.error("Create Goods Receipt Error:", error)
    return { error: error.message || "Failed to create goods receipt" }
  }
}

export async function deleteGoodsReceipt(grnId: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    const grn = await prisma.goodsReceipt.findUnique({
      where: { id: grnId }
    })

    if (!grn) {
      return { error: "Goods receipt not found" }
    }

    await prisma.$transaction(async (tx) => {
      // Delete the GRN
      await tx.goodsReceipt.delete({
        where: { id: grnId }
      })

      // Re-check if PO is still fully delivered, revert status if needed
      const po = await tx.purchaseOrder.findUnique({
        where: { id: grn.poId },
        include: {
          items: true,
          deliveries: {
            include: { items: true }
          }
        }
      })

      if (po) {
        const receivedMap = new Map<string, number>()
        for (const delivery of po.deliveries) {
          for (const item of delivery.items) {
            receivedMap.set(
              item.productId,
              (receivedMap.get(item.productId) || 0) + item.quantityReceived
            )
          }
        }

        const isAllFullyDelivered =
          po.items.length > 0 &&
          po.items.every((pi) => {
            const totalReceived = receivedMap.get(pi.productId) || 0
            return totalReceived >= pi.quantity
          })

        if (!isAllFullyDelivered && po.status === "COMPLETED") {
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { status: "ISSUED" }
          })
        } else if (isAllFullyDelivered && po.status !== "COMPLETED") {
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { status: "COMPLETED" }
          })
        }
      }
    })

    revalidatePath("/purchase-orders")
    revalidatePath(`/purchase-orders/${grn.poId}`)

    return { success: true }
  } catch (error: any) {
    console.error("Delete Goods Receipt Error:", error)
    return { error: error.message || "Failed to delete goods receipt" }
  }
}

export async function updateGoodsReceipt(
  id: string,
  data: {
    grnNumber?: string
    notes?: string
    items: { productId: string; quantityReceived: number }[]
  }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    const existingGrn = await prisma.goodsReceipt.findUnique({
      where: { id }
    })

    if (!existingGrn) {
      return { error: "Goods receipt not found" }
    }

    const poId = existingGrn.poId

    const updatedGrn = await prisma.$transaction(async (tx) => {
      // Fetch the PO with items and deliveries
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
          items: {
            include: { product: true }
          },
          deliveries: {
            include: { items: true }
          }
        }
      })

      if (!po) {
        throw new Error("Purchase Order not found")
      }

      // Calculate receivedMap excluding current GRN
      const receivedMap = new Map<string, number>()
      for (const delivery of po.deliveries) {
        if (delivery.id === id) continue // Exclude current GRN
        for (const item of delivery.items) {
          receivedMap.set(
            item.productId,
            (receivedMap.get(item.productId) || 0) + item.quantityReceived
          )
        }
      }

      const itemsToReceive = data.items.filter((i) => i.quantityReceived > 0)
      if (itemsToReceive.length === 0) {
        throw new Error("At least one item must have a received quantity greater than 0")
      }

      for (const item of data.items) {
        if (item.quantityReceived < 0) {
          throw new Error("Received quantity cannot be negative")
        }

        const poItem = po.items.find((pi) => pi.productId === item.productId)
        if (!poItem) {
          throw new Error("Product not found in Purchase Order items")
        }

        const alreadyReceived = receivedMap.get(item.productId) || 0
        if (alreadyReceived + item.quantityReceived > poItem.quantity) {
          throw new Error(
            `Received quantity exceeds ordered quantity for ${poItem.product.materialCode}`
          )
        }
      }

      // Delete existing GoodsReceiptItem records for this GRN
      await tx.goodsReceiptItem.deleteMany({
        where: { goodsReceiptId: id }
      })

      // Update the GoodsReceipt
      const newGrnNumber = data.grnNumber?.trim() || existingGrn.grnNumber
      const newGrn = await tx.goodsReceipt.update({
        where: { id },
        data: {
          grnNumber: newGrnNumber,
          notes: data.notes?.trim() || null,
          items: {
            create: itemsToReceive.map((item) => ({
              productId: item.productId,
              quantityReceived: item.quantityReceived
            }))
          }
        },
        include: {
          items: {
            include: { product: true }
          }
        }
      })

      // Re-check if PO is fully delivered
      const updatedReceivedMap = new Map<string, number>(receivedMap)
      for (const item of itemsToReceive) {
        updatedReceivedMap.set(
          item.productId,
          (updatedReceivedMap.get(item.productId) || 0) + item.quantityReceived
        )
      }

      const isAllFullyDelivered =
        po.items.length > 0 &&
        po.items.every((pi) => {
          const totalReceived = updatedReceivedMap.get(pi.productId) || 0
          return totalReceived >= pi.quantity
        })

      if (isAllFullyDelivered) {
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: { status: "COMPLETED" }
        })
      } else {
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: { status: "ISSUED" }
        })
      }

      return newGrn
    })

    revalidatePath("/purchase-orders")
    revalidatePath(`/purchase-orders/${poId}`)

    return { success: true, grn: updatedGrn }
  } catch (error: any) {
    console.error("Update Goods Receipt Error:", error)
    return { error: error.message || "Failed to update goods receipt" }
  }
}
