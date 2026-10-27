"use server"
import { prisma } from "@/lib/prisma"
import { generateSlug } from "@/lib/slugify"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function createQuickProduct(data: {
  materialCode: string
  materialDescription: string
  unit: string
  gstRate: number
  sellingPrice?: number // paise
  costPrice?: number // paise
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    
    const id = generateSlug(`${data.materialCode} ${data.materialDescription}`, true)
    const sp = data.sellingPrice || 0
    const cp = data.costPrice || 0
    
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          id,
          materialCode: data.materialCode?.trim() || `RAD-${Math.floor(10000000 + Math.random() * 90000000)}`,
          materialDescription: data.materialDescription.trim(),
          unit: data.unit || "NUM",
          gstRate: data.gstRate || 18,
          costPrice: cp,
          sellingPrice: sp
        }
      })

      if (cp > 0 || sp > 0) {
        await tx.priceHistory.create({
          data: {
            productId: created.id,
            costPrice: cp,
            sellingPrice: sp
          }
        })
      }

      return created
    })
    
    revalidatePath("/products")
    return { success: true, product }
  } catch (error: any) {
    return { error: error.message || "Failed to create product" }
  }
}

export async function createProduct(formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }
    let materialCode = String(formData.get("materialCode") || "").trim()
    if (!materialCode) {
      materialCode = `RAD-${Math.floor(10000000 + Math.random() * 90000000)}`
    }
    const materialDescription = String(formData.get("materialDescription") || "").trim()
    
    // Convert inputs from rupees to paise, default to 0 if NaN/Empty
    const cpVal = parseFloat(String(formData.get("costPrice")))
    const cp = isNaN(cpVal) ? 0 : Math.round(cpVal * 100)
    
    const commCpStr = formData.get("commissionCostPrice")
    const commissionCp = commCpStr && !isNaN(parseFloat(String(commCpStr))) ? Math.round(parseFloat(String(commCpStr)) * 100) : null
    
    const spVal = parseFloat(String(formData.get("sellingPrice")))
    const sp = isNaN(spVal) ? 0 : Math.round(spVal * 100)
    
    const gstVal = parseFloat(String(formData.get("gstRate")))
    const gstRate = isNaN(gstVal) ? 18.0 : gstVal

    const supplierName = String(formData.get("supplierName") || "").trim()
    let finalSupplierId: string | null = null

    if (supplierName) {
      const allSuppliers = await prisma.supplier.findMany()
      const existing = allSuppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase())
      
      if (existing) {
        finalSupplierId = existing.id
      } else {
        const newSupplier = await prisma.supplier.create({
          data: {
            id: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
            name: supplierName
          }
        })
        finalSupplierId = newSupplier.id
      }
    }

    const imageUrl = formData.get("imageUrl") as string | null
    const specification = formData.get("specification") ? String(formData.get("specification")) : null

    const id = generateSlug(`${materialCode} ${materialDescription}`, true)

    await prisma.$transaction(async (tx) => {
      await tx.product.create({
        data: {
          id,
          materialCode,
          materialDescription,
          specification,
          imageUrl,
          make: formData.get("make") ? String(formData.get("make")) : null,
          modelNo: formData.get("modelNo") ? String(formData.get("modelNo")) : null,
          unit: formData.get("unit") ? String(formData.get("unit")) : "NUM",
          costPrice: cp,
          commissionCostPrice: commissionCp,
          sellingPrice: sp,
          gstRate,
          supplierId: finalSupplierId,
        }
      })

      if (cp > 0 || sp > 0) {
        await tx.priceHistory.create({
          data: {
            productId: id,
            costPrice: cp,
            sellingPrice: sp
          }
        })
      }

      if (finalSupplierId && cp > 0) {
        await tx.productSupplier.upsert({
          where: { productId_supplierId: { productId: id, supplierId: finalSupplierId } },
          update: { costPrice: cp },
          create: { productId: id, supplierId: finalSupplierId, costPrice: cp }
        })
      }
    })

    revalidatePath("/products")
    return { success: true }
  } catch (error: any) {
    console.error("Product creation error:", error)
    return { error: error.message || "Failed to create product" }
  }
}

export async function updateProduct(id: string, formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }
    const materialCode = String(formData.get("materialCode") || "").trim()
    const materialDescription = String(formData.get("materialDescription") || "").trim()
    
    const cpVal = parseFloat(String(formData.get("costPrice")))
    const cp = isNaN(cpVal) ? 0 : Math.round(cpVal * 100)
    
    const commCpStr = formData.get("commissionCostPrice")
    const commissionCp = commCpStr && !isNaN(parseFloat(String(commCpStr))) ? Math.round(parseFloat(String(commCpStr)) * 100) : null
    
    const spVal = parseFloat(String(formData.get("sellingPrice")))
    const sp = isNaN(spVal) ? 0 : Math.round(spVal * 100)
    
    const gstVal = parseFloat(String(formData.get("gstRate")))
    const gstRate = isNaN(gstVal) ? 18.0 : gstVal

    const supplierName = String(formData.get("supplierName") || "").trim()
    let finalSupplierId: string | null = null

    if (supplierName) {
      const allSuppliers = await prisma.supplier.findMany()
      const existing = allSuppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase())
      
      if (existing) {
        finalSupplierId = existing.id
      } else {
        const newSupplier = await prisma.supplier.create({
          data: {
            id: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
            name: supplierName
          }
        })
        finalSupplierId = newSupplier.id
      }
    }
    
    const imageUrl = formData.get("imageUrl") as string | null
    const specification = formData.get("specification") ? String(formData.get("specification")) : null

    const data: any = {
      materialCode,
      materialDescription,
      specification,
      make: formData.get("make") ? String(formData.get("make")) : null,
      modelNo: formData.get("modelNo") ? String(formData.get("modelNo")) : null,
      unit: formData.get("unit") ? String(formData.get("unit")) : "NUM",
      costPrice: cp,
      commissionCostPrice: commissionCp,
      sellingPrice: sp,
      gstRate,
      supplierId: finalSupplierId,
    }

    if (imageUrl) {
      data.imageUrl = imageUrl
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { priceHistory: true } } }
    })
    
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data
      })
      
      if (existingProduct && (existingProduct.costPrice !== cp || existingProduct.sellingPrice !== sp)) {
        // Seed baseline if history was empty and old product had prices
        if (existingProduct._count.priceHistory === 0 && (existingProduct.costPrice > 0 || existingProduct.sellingPrice > 0)) {
          await tx.priceHistory.create({
            data: {
              productId: id,
              costPrice: existingProduct.costPrice,
              sellingPrice: existingProduct.sellingPrice,
              changedAt: existingProduct.createdAt
            }
          })
        }

        await tx.priceHistory.create({
          data: {
            productId: id,
            costPrice: cp,
            sellingPrice: sp,
          }
        })
      }

      if (finalSupplierId && cp > 0) {
        await tx.productSupplier.upsert({
          where: { productId_supplierId: { productId: id, supplierId: finalSupplierId } },
          update: { costPrice: cp },
          create: { productId: id, supplierId: finalSupplierId, costPrice: cp }
        })
      }
    })

    revalidatePath("/products")
    revalidatePath(`/products/${id}/edit`)
    return { success: true }
  } catch (error: any) {
    console.error("Product update error:", error)
    return { error: error.message || "Failed to update product" }
  }
}

export async function saveProductSellingPrice(
  productId: string,
  sellingPricePaise: number,
  costPricePaise?: number
) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { _count: { select: { priceHistory: true } } }
    })

    if (!existingProduct) return { error: "Product not found" }

    const nextSp = Math.round(sellingPricePaise)
    const nextCp = costPricePaise !== undefined && costPricePaise > 0
      ? Math.round(costPricePaise)
      : existingProduct.costPrice

    const hasChanged = existingProduct.sellingPrice !== nextSp || existingProduct.costPrice !== nextCp

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          sellingPrice: nextSp,
          costPrice: nextCp
        }
      })

      if (hasChanged) {
        if (existingProduct._count.priceHistory === 0 && (existingProduct.costPrice > 0 || existingProduct.sellingPrice > 0)) {
          await tx.priceHistory.create({
            data: {
              productId,
              costPrice: existingProduct.costPrice,
              sellingPrice: existingProduct.sellingPrice,
              changedAt: existingProduct.createdAt
            }
          })
        }

        await tx.priceHistory.create({
          data: {
            productId,
            costPrice: nextCp,
            sellingPrice: nextSp
          }
        })
      }
    })

    revalidatePath("/products")
    revalidatePath(`/products/${productId}/edit`)
    return { success: true, sellingPrice: nextSp, costPrice: nextCp, hasChanged }
  } catch (error: any) {
    console.error("Save product selling price error:", error)
    return { error: error.message || "Failed to save selling price" }
  }
}

export async function getProductPricingHistory(productId: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        materialCode: true,
        materialDescription: true,
        sellingPrice: true,
        costPrice: true,
        commissionCostPrice: true,
        unit: true,
        gstRate: true,
        priceHistory: {
          orderBy: { changedAt: "desc" },
          take: 25
        },
        quotationItems: {
          where: { spSnapshot: { gt: 0 } },
          orderBy: { quotation: { createdAt: "desc" } },
          take: 15,
          select: {
            id: true,
            spSnapshot: true,
            cpSnapshot: true,
            quantity: true,
            quotation: {
              select: {
                id: true,
                prNo: true,
                status: true,
                createdAt: true,
                client: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!product) return { error: "Product not found" }

    return {
      success: true,
      data: {
        product: {
          id: product.id,
          materialCode: product.materialCode,
          materialDescription: product.materialDescription,
          sellingPrice: product.sellingPrice,
          costPrice: product.costPrice,
          commissionCostPrice: product.commissionCostPrice,
          unit: product.unit,
          gstRate: product.gstRate,
        },
        priceHistory: product.priceHistory,
        quotedHistory: product.quotationItems
      }
    }
  } catch (error: any) {
    console.error("Get product pricing history error:", error)
    return { error: error.message || "Failed to fetch pricing history" }
  }
}

export async function quickUpdateProductPrices(
  productId: string,
  data: { costPriceInRupees: number; sellingPriceInRupees: number; note?: string }
) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const cp = Math.max(0, Math.round((Number(data.costPriceInRupees) || 0) * 100))
    const sp = Math.max(0, Math.round((Number(data.sellingPriceInRupees) || 0) * 100))

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { _count: { select: { priceHistory: true } } },
    })

    if (!existingProduct) {
      return { error: "Product not found" }
    }

    const hasChanged = existingProduct.costPrice !== cp || existingProduct.sellingPrice !== sp

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          costPrice: cp,
          sellingPrice: sp,
        },
      })

      if (hasChanged) {
        if (
          existingProduct._count.priceHistory === 0 &&
          (existingProduct.costPrice > 0 || existingProduct.sellingPrice > 0)
        ) {
          await tx.priceHistory.create({
            data: {
              productId,
              costPrice: existingProduct.costPrice,
              sellingPrice: existingProduct.sellingPrice,
              changedAt: existingProduct.createdAt,
            },
          })
        }

        await tx.priceHistory.create({
          data: {
            productId,
            costPrice: cp,
            sellingPrice: sp,
          },
        })
      }
    })

    revalidatePath("/products")
    revalidatePath(`/products/${productId}/edit`)
    return { success: true, costPrice: cp, sellingPrice: sp, hasChanged }
  } catch (error: any) {
    console.error("Quick update product prices error:", error)
    return { error: error.message || "Failed to update product prices" }
  }
}

export async function tagVendorToProductCp(data: {
  productId: string
  vendorName: string
  costPriceInPaise: number
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const trimmedName = (data.vendorName || "").trim()
    if (!trimmedName) {
      return { error: "Vendor name is required" }
    }

    const cpPaise = Math.max(0, Math.round(Number(data.costPriceInPaise) || 0))

    const allSuppliers = await prisma.supplier.findMany({
      select: { id: true, name: true },
    })
    let supplier = allSuppliers.find(
      (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )

    if (!supplier) {
      let candidateId = generateSlug(trimmedName)
      if (!candidateId || allSuppliers.some((s) => s.id === candidateId)) {
        candidateId = generateSlug(trimmedName, true)
      }
      supplier = await prisma.supplier.create({
        data: {
          id: candidateId,
          name: trimmedName,
        },
        select: { id: true, name: true },
      })
    }

    const productSupplier = await prisma.productSupplier.upsert({
      where: {
        productId_supplierId: {
          productId: data.productId,
          supplierId: supplier.id,
        },
      },
      update: {
        costPrice: cpPaise,
      },
      create: {
        productId: data.productId,
        supplierId: supplier.id,
        costPrice: cpPaise,
      },
    })

    // Also link primary supplierId on Product if none was set
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { supplierId: true },
    })
    if (product && !product.supplierId) {
      await prisma.product.update({
        where: { id: data.productId },
        data: { supplierId: supplier.id },
      })
    }

    revalidatePath("/products")
    revalidatePath(`/products/${data.productId}/edit`)
    revalidatePath("/quotations/new")
    revalidatePath("/quotations")

    return {
      success: true,
      productSupplierId: productSupplier.id,
      supplier: { id: supplier.id, name: supplier.name },
      costPrice: cpPaise,
    }
  } catch (error: any) {
    console.error("Tag vendor to product CP error:", error)
    return { error: error.message || "Failed to tag vendor to cost price" }
  }
}
