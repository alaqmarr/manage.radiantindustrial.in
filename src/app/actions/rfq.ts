"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"
import { generateSmartRfqId, generateSmartPoId } from "@/lib/smartId"

type RfqItemData = {
  product: {
    id: string
    materialCode: string
    materialDescription: string
    unit: string
    gstRate: number
  }
  quantity: number
  comment?: string
}

export async function getRfqUpdatedAt(id: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const r = await prisma.rfq.findUnique({
      where: { id },
      select: { updatedAt: true },
    })

    if (!r) return { error: "Not found" }

    return { success: true, updatedAt: r.updatedAt }
  } catch (e: any) {
    return { error: "Failed to check status" }
  }
}

export async function createRfq(data: {
  supplierId?: string
  isPublic?: boolean
  status: string // DRAFT or ISSUED
  items: RfqItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (data.items.length === 0) {
      return { error: "RFQ must have at least one item" }
    }

    if (!data.isPublic && !data.supplierId) {
      return { error: "Must select a supplier if not public" }
    }

    const codeCounts = new Map<string, number>()
    for (const item of data.items) {
      codeCounts.set(item.product.materialCode, (codeCounts.get(item.product.materialCode) || 0) + 1)
    }

    for (const item of data.items) {
      const isMultiVariant = (codeCounts.get(item.product.materialCode) || 0) > 1
      const p = await prisma.product.upsert({
        where: { materialCode: item.product.materialCode },
        update: {
          ...(isMultiVariant ? {} : { materialDescription: item.product.materialDescription }),
          unit: item.product.unit,
          gstRate: item.product.gstRate,
        },
        create: {
          id: generateSlug(
            `${item.product.materialCode} ${item.product.materialDescription}`,
            true
          ),
          materialCode: item.product.materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.product.gstRate,
          costPrice: 0,
          sellingPrice: 0,
        },
      })
      item.product.id = p.id
    }

    const id = await generateSmartRfqId(data.supplierId, data.isPublic)

    const crypto = require("crypto")
    const publicToken = data.isPublic ? crypto.randomBytes(16).toString("hex") : null

    const rfq = await prisma.rfq.create({
      data: {
        id,
        supplierId: data.isPublic ? null : data.supplierId,
        isPublic: data.isPublic || false,
        publicToken,
        status: data.status,
        items: {
          create: data.items.map((item, index) => ({
            id: `${id}-item-${index + 1}`,
            productId: item.product.id,
            itemDescription: item.product.materialDescription || null,
            quantity: item.quantity,
            comment: item.comment || null,
          })),
        },
      },
    })

    revalidatePath("/rfq")
    return { success: true, id: rfq.id, publicToken }
  } catch (error: any) {
    console.error("Create RFQ Error:", error)
    return { error: error.message || "Failed to create RFQ" }
  }
}

export async function upsertDraftRfq(data: {
  id?: string
  supplierId?: string
  isPublic?: boolean
  status?: string
  expectedUpdatedAt?: Date
  items: RfqItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!data.isPublic && !data.supplierId) {
      return { error: "Must select a supplier if not public" }
    }

    if (data.id && data.expectedUpdatedAt) {
      const current = await prisma.rfq.findUnique({
        where: { id: data.id },
        select: { updatedAt: true },
      })

      if (current && current.updatedAt.getTime() > new Date(data.expectedUpdatedAt).getTime()) {
        return {
          error:
            "CONFLICT: Someone else has updated this RFQ since you opened it. Please refresh the page to see the latest changes.",
        }
      }
    }

    let rfqId = data.id
    const finalStatus = data.status || "DRAFT"

    const codeCounts = new Map<string, number>()
    for (const item of data.items) {
      codeCounts.set(item.product.materialCode, (codeCounts.get(item.product.materialCode) || 0) + 1)
    }

    for (const item of data.items) {
      const isMultiVariant = (codeCounts.get(item.product.materialCode) || 0) > 1
      const p = await prisma.product.upsert({
        where: { materialCode: item.product.materialCode },
        update: {
          ...(isMultiVariant ? {} : { materialDescription: item.product.materialDescription }),
          unit: item.product.unit,
          gstRate: item.product.gstRate,
        },
        create: {
          id: generateSlug(
            `${item.product.materialCode} ${item.product.materialDescription}`,
            true
          ),
          materialCode: item.product.materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.product.gstRate,
          costPrice: 0,
          sellingPrice: 0,
        },
      })
      item.product.id = p.id
    }

    const crypto = require("crypto")

    if (!rfqId) {
      rfqId = await generateSmartRfqId(data.supplierId, data.isPublic)

      const publicToken = data.isPublic ? crypto.randomBytes(16).toString("hex") : null

      await prisma.rfq.create({
        data: {
          id: rfqId,
          supplierId: data.isPublic ? null : data.supplierId,
          isPublic: data.isPublic || false,
          publicToken,
          status: finalStatus,
          items: {
            create: data.items.map((item, index) => ({
              id: `${rfqId}-item-${index + 1}`,
              productId: item.product.id,
              itemDescription: item.product.materialDescription || null,
              quantity: item.quantity,
              comment: item.comment || null,
            })),
          },
        },
      })
    } else {
      await prisma.$transaction(async (tx) => {
        const currentRfq = await tx.rfq.findUnique({
          where: { id: rfqId },
          include: { items: { orderBy: { id: "asc" } } },
        })

        let newToken = currentRfq?.publicToken
        if (data.isPublic && !newToken) {
          newToken = crypto.randomBytes(16).toString("hex")
        }

        const existingItems = currentRfq?.items || []
        const keptItemIds = new Set<string>()

        // Update existing items in-place by position when productId matches so vendor bids stay linked
        const itemsToCreate: {
          id: string
          productId: string
          itemDescription: string | null
          quantity: number
          comment: string | null
        }[] = []

        for (let index = 0; index < data.items.length; index++) {
          const item = data.items[index]
          const matchExisting = existingItems.find(
            (ex) => !keptItemIds.has(ex.id) && ex.productId === item.product.id
          )

          if (matchExisting) {
            keptItemIds.add(matchExisting.id)
            await tx.rfqItem.update({
              where: { id: matchExisting.id },
              data: {
                itemDescription: item.product.materialDescription || null,
                quantity: item.quantity,
                comment: item.comment || null,
              },
            })
          } else {
            itemsToCreate.push({
              id: `${rfqId}-item-${index + 1}-${Date.now().toString(36).slice(-4)}`,
              productId: item.product.id,
              itemDescription: item.product.materialDescription || null,
              quantity: item.quantity,
              comment: item.comment || null,
            })
          }
        }

        const removedIds = existingItems
          .filter((ex) => !keptItemIds.has(ex.id))
          .map((ex) => ex.id)

        if (removedIds.length > 0) {
          await tx.rfqVendorResponseItem.deleteMany({
            where: { rfqItemId: { in: removedIds } },
          })
          await tx.rfqItem.deleteMany({
            where: { id: { in: removedIds } },
          })
        }

        await tx.rfq.update({
          where: { id: rfqId },
          data: {
            supplierId: data.isPublic ? null : data.supplierId,
            isPublic: data.isPublic || false,
            publicToken: newToken,
            status: finalStatus,
            ...(itemsToCreate.length > 0
              ? {
                  items: {
                    create: itemsToCreate,
                  },
                }
              : {}),
          },
        })
      })
    }

    revalidatePath("/rfq")
    revalidatePath(`/rfq/${rfqId}`)
    return { success: true, id: rfqId }
  } catch (error: any) {
    console.error("Upsert Draft RFQ Error:", error)
    return { error: error.message || "Failed to save draft" }
  }
}

export async function deleteRfq(id: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    await prisma.rfq.delete({
      where: { id },
    })

    revalidatePath("/rfq")
    return { success: true }
  } catch (error: any) {
    console.error("Delete RFQ Error:", error)
    return { error: error.message || "Failed to delete RFQ" }
  }
}

export async function updateRfqStatus(id: string, newStatus: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    await prisma.rfq.update({
      where: { id },
      data: { status: newStatus },
    })

    revalidatePath("/rfq")
    return { success: true }
  } catch (error: any) {
    console.error("Update RFQ Status Error:", error)
    return { error: error.message || "Failed to update RFQ status" }
  }
}

export async function submitRfqResponse(
  token: string,
  data: {
    vendorName: string
    vendorEmail?: string
    vendorPhone?: string
    items: { rfqItemId: string; unitPrice: number; leadTime?: string; remarks?: string }[]
  }
) {
  try {
    const trimmedName = (data.vendorName || "").trim()
    const trimmedEmail = (data.vendorEmail || "").trim()
    const trimmedPhone = (data.vendorPhone || "").trim()

    if (!trimmedName) {
      return { error: "Company / Vendor Name is required." }
    }

    const rfq = await prisma.rfq.findUnique({
      where: { publicToken: token },
      include: { items: true },
    })

    if (!rfq || !rfq.isPublic) return { error: "Invalid or inactive Public RFQ link." }
    if (rfq.status === "COMPLETED") return { error: "This RFQ has already been closed." }

    if (!data.items.some((i) => i.unitPrice > 0)) {
      return { error: "Please enter a valid unit price for at least one item." }
    }

    // Case-insensitive match against existing suppliers by name or email
    const allSuppliers = await prisma.supplier.findMany({
      select: { id: true, name: true, email: true },
    })
    const matchingSupplier = allSuppliers.find(
      (s) =>
        s.name.trim().toLowerCase() === trimmedName.toLowerCase() ||
        (trimmedEmail && s.email && s.email.trim().toLowerCase() === trimmedEmail.toLowerCase())
    )

    await prisma.rfqVendorResponse.create({
      data: {
        rfqId: rfq.id,
        supplierId: matchingSupplier ? matchingSupplier.id : null,
        vendorName: trimmedName,
        vendorEmail: trimmedEmail || null,
        vendorPhone: trimmedPhone || null,
        items: {
          create: data.items.map((item) => ({
            rfqItemId: item.rfqItemId,
            unitPrice: Math.max(0, Math.round(item.unitPrice || 0)),
            leadTime: item.leadTime?.trim() || null,
            remarks: item.remarks?.trim() || null,
          })),
        },
      },
    })

    // Ensure RFQ status reflects active bidding if still DRAFT
    if (rfq.status === "DRAFT") {
      await prisma.rfq.update({
        where: { id: rfq.id },
        data: { status: "ISSUED" },
      })
    }

    // If matched to a registered supplier, update ProductSupplier catalog prices ONLY for quoted items (> 0)
    if (matchingSupplier) {
      for (const item of data.items) {
        if (!item.unitPrice || item.unitPrice <= 0) continue
        const rfqItem = rfq.items.find((i) => i.id === item.rfqItemId)
        if (rfqItem) {
          await prisma.productSupplier.upsert({
            where: {
              productId_supplierId: {
                productId: rfqItem.productId,
                supplierId: matchingSupplier.id,
              },
            },
            update: { costPrice: Math.round(item.unitPrice) },
            create: {
              productId: rfqItem.productId,
              supplierId: matchingSupplier.id,
              costPrice: Math.round(item.unitPrice),
            },
          })
        }
      }
    }

    revalidatePath("/rfq")
    revalidatePath(`/rfq/${rfq.id}`)
    revalidatePath(`/vendor-quote/${token}`)
    return { success: true }
  } catch (error: any) {
    console.error("Submit RFQ Response Error:", error)
    return { error: error.message || "Failed to submit quotation response" }
  }
}

export async function convertRfqResponseToPo(responseId: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const response = await prisma.rfqVendorResponse.findUnique({
      where: { id: responseId },
      include: {
        rfq: { include: { items: { include: { product: true } } } },
        supplier: true,
        items: true,
      },
    })

    if (!response) return { error: "Vendor response not found" }

    const quotedItems = response.items.filter((ri) => ri.unitPrice > 0)
    if (quotedItems.length === 0) {
      return { error: "Cannot create PO: this vendor response has no priced items." }
    }

    // Resolve or auto-register Supplier so awarding a Public RFQ bid always works in 1 click
    let supplier = response.supplier
    if (!supplier) {
      const allSuppliers = await prisma.supplier.findMany()
      supplier =
        allSuppliers.find(
          (s) =>
            s.name.trim().toLowerCase() === response.vendorName.trim().toLowerCase() ||
            (response.vendorEmail &&
              s.email &&
              s.email.trim().toLowerCase() === response.vendorEmail.trim().toLowerCase())
        ) || null

      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: {
            id: generateSlug(response.vendorName, true),
            name: response.vendorName.trim(),
            email: response.vendorEmail || null,
            contact: response.vendorPhone || null,
          },
        })
      }

      await prisma.rfqVendorResponse.update({
        where: { id: response.id },
        data: { supplierId: supplier.id },
      })
    }

    // Sync quoted vendor rates into ProductSupplier catalog
    for (const ri of quotedItems) {
      const rfqItem = response.rfq.items.find((i) => i.id === ri.rfqItemId)
      if (rfqItem) {
        await prisma.productSupplier.upsert({
          where: {
            productId_supplierId: {
              productId: rfqItem.productId,
              supplierId: supplier.id,
            },
          },
          update: { costPrice: ri.unitPrice },
          create: {
            productId: rfqItem.productId,
            supplierId: supplier.id,
            costPrice: ri.unitPrice,
          },
        })
      }
    }

    const smartPo = await generateSmartPoId(supplier.id)
    const poId = smartPo.id
    const poNumber = smartPo.poNumber

    let totalAmount = 0
    let totalGst = 0

    const poItemsData = quotedItems.map((responseItem, idx) => {
      const rfqItem = response.rfq.items.find((i) => i.id === responseItem.rfqItemId)
      if (!rfqItem) throw new Error("Mismatched RFQ line item")

      const amount = responseItem.unitPrice * rfqItem.quantity
      const gst = amount * (rfqItem.product.gstRate / 100)

      totalAmount += amount
      totalGst += gst

      return {
        id: `${poId}-item-${idx + 1}`,
        productId: rfqItem.productId,
        itemDescription: rfqItem.itemDescription || rfqItem.product.materialDescription || null,
        quantity: rfqItem.quantity,
        unitPrice: responseItem.unitPrice,
        gstRate: rfqItem.product.gstRate,
        comment: responseItem.remarks || undefined,
      }
    })

    const po = await prisma.purchaseOrder.create({
      data: {
        id: poId,
        poNumber,
        supplierId: supplier.id,
        rfqId: response.rfqId,
        status: "DRAFT",
        totalAmount: Math.round(totalAmount),
        totalGst: Math.round(totalGst),
        items: {
          create: poItemsData,
        },
      },
    })

    await prisma.rfq.update({
      where: { id: response.rfqId },
      data: { status: "COMPLETED" },
    })

    revalidatePath("/suppliers")
    revalidatePath("/products")
    revalidatePath("/purchase-orders")
    revalidatePath("/rfq")
    revalidatePath(`/rfq/${response.rfqId}`)
    return { success: true, id: po.id }
  } catch (error: any) {
    console.error("Convert RFQ to PO Error:", error)
    return { error: error.message || "Failed to convert RFQ to PO" }
  }
}
