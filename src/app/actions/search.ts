"use server"

import { prisma } from "@/lib/prisma"

export interface GlobalSearchResults {
  quotations: {
    id: string
    prNo: string | null
    rfqNo: string | null
    status: string
    totalAmount: number
    client: { name: string }
  }[]
  purchaseOrders: {
    id: string
    poNumber: string | null
    status: string
    totalAmount: number
    supplier: { name: string }
  }[]
  products: {
    id: string
    materialCode: string
    materialDescription: string
    make: string | null
    sellingPrice: number
    costPrice: number
  }[]
  clients: {
    id: string
    name: string
    gstNumber: string | null
    location: string | null
  }[]
  suppliers: {
    id: string
    name: string
    gstNumber: string | null
    location: string | null
  }[]
}

export async function globalSearchAction(query: string): Promise<GlobalSearchResults> {
  const q = query.trim()

  const quotationWhere = q
    ? {
        OR: [
          { id: { contains: q } },
          { prNo: { contains: q } },
          { rfqNo: { contains: q } },
          { client: { name: { contains: q } } },
        ],
      }
    : {}

  const poWhere = q
    ? {
        OR: [
          { id: { contains: q } },
          { poNumber: { contains: q } },
          { supplier: { name: { contains: q } } },
        ],
      }
    : {}

  const productWhere = q
    ? {
        OR: [
          { materialCode: { contains: q } },
          { materialDescription: { contains: q } },
          { make: { contains: q } },
        ],
      }
    : {}

  const clientWhere = q
    ? {
        OR: [
          { name: { contains: q } },
          { gstNumber: { contains: q } },
        ],
      }
    : {}

  const supplierWhere = q
    ? {
        OR: [
          { name: { contains: q } },
          { gstNumber: { contains: q } },
        ],
      }
    : {}

  const [quotations, purchaseOrders, products, clients, suppliers] = await Promise.all([
    prisma.quotation.findMany({
      where: quotationWhere,
      orderBy: { updatedAt: "desc" },
      take: q ? 5 : 3,
      select: {
        id: true,
        prNo: true,
        rfqNo: true,
        status: true,
        totalAmount: true,
        client: {
          select: { name: true },
        },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: poWhere,
      orderBy: { updatedAt: "desc" },
      take: q ? 5 : 3,
      select: {
        id: true,
        poNumber: true,
        status: true,
        totalAmount: true,
        supplier: {
          select: { name: true },
        },
      },
    }),
    prisma.product.findMany({
      where: productWhere,
      orderBy: { updatedAt: "desc" },
      take: q ? 5 : 3,
      select: {
        id: true,
        materialCode: true,
        materialDescription: true,
        make: true,
        sellingPrice: true,
        costPrice: true,
      },
    }),
    prisma.client.findMany({
      where: clientWhere,
      orderBy: { updatedAt: "desc" },
      take: q ? 4 : 2,
      select: {
        id: true,
        name: true,
        gstNumber: true,
        location: true,
      },
    }),
    prisma.supplier.findMany({
      where: supplierWhere,
      orderBy: { updatedAt: "desc" },
      take: q ? 4 : 2,
      select: {
        id: true,
        name: true,
        gstNumber: true,
        location: true,
      },
    }),
  ])

  return {
    quotations,
    purchaseOrders,
    products,
    clients,
    suppliers,
  }
}

export interface SidebarBadges {
  quotationsNeedingAction: number
  openRfqs: number
  draftPos: number
  unpaidDues: number
}

export async function getSidebarBadgesAction(): Promise<SidebarBadges> {
  const [pendingQuotesCount, acceptedQuotes, openRfqs, draftPos, unpaidDues] = await Promise.all([
    prisma.quotation.count({
      where: { status: "PENDING" },
    }),
    prisma.quotation.findMany({
      where: { status: "ACCEPTED" },
      select: {
        id: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            isConfirmed: true,
          },
        },
        purchaseOrders: {
          where: { status: { not: "CANCELLED" } },
          select: {
            items: {
              select: {
                productId: true,
                quantity: true,
              },
            },
          },
        },
        purchases: {
          select: {
            items: {
              select: {
                productId: true,
                quantity: true,
              },
            },
          },
        },
      },
    }),
    prisma.rfq.count({
      where: { status: "ISSUED" },
    }),
    prisma.purchaseOrder.count({
      where: { status: "DRAFT" },
    }),
    prisma.quotation.count({
      where: {
        status: { in: ["ACCEPTED", "COMPLETED"] },
        paymentStatus: { not: "PAID" },
      },
    }),
  ])

  let acceptedUnorderedCount = 0
  for (const quote of acceptedQuotes) {
    const orderedMap = new Map<string, number>()
    for (const po of quote.purchaseOrders) {
      for (const pi of po.items) {
        orderedMap.set(pi.productId, (orderedMap.get(pi.productId) || 0) + pi.quantity)
      }
    }
    for (const pur of quote.purchases) {
      for (const pi of pur.items) {
        orderedMap.set(pi.productId, (orderedMap.get(pi.productId) || 0) + pi.quantity)
      }
    }
    const confirmedItems = quote.items.filter((i) => i.isConfirmed !== false)
    const isFullyOrdered =
      confirmedItems.length > 0 &&
      confirmedItems.every((i) => (orderedMap.get(i.productId) || 0) >= i.quantity)

    if (!isFullyOrdered) {
      acceptedUnorderedCount++
    }
  }

  return {
    quotationsNeedingAction: pendingQuotesCount + acceptedUnorderedCount,
    openRfqs,
    draftPos,
    unpaidDues,
  }
}
