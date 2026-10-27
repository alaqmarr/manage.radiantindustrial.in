import { prisma } from "@/lib/prisma"

const NOISE_WORDS = new Set([
  "m/s",
  "ms",
  "messrs",
  "the",
  "and",
  "&",
  "of",
])

const CORPORATE_SUFFIXES = new Set([
  "pvt",
  "private",
  "ltd",
  "limited",
  "llp",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
])

/**
 * Extracts clean lowercase initials from a company name.
 * Examples:
 * - "WEST COAST OPTILINKS" -> "wco"
 * - "West Coast Optilinks Pvt. Ltd." -> "wco"
 * - "BHEL" -> "bhel"
 * - "Reliance Industries Limited" -> "ri"
 */
export function getCompanyInitials(companyName: string, fallback = "doc"): string {
  if (!companyName || !companyName.trim()) return fallback

  const rawTokens = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !NOISE_WORDS.has(w))

  if (rawTokens.length === 0) return fallback

  // Strip corporate suffixes if at least 2 core words remain, or if 1 core word remains
  const coreTokens = rawTokens.filter((w) => !CORPORATE_SUFFIXES.has(w))
  const tokens = coreTokens.length > 0 ? coreTokens : rawTokens

  if (tokens.length === 1) {
    const word = tokens[0]
    return word.length <= 5 ? word : word.slice(0, 3)
  }

  return tokens
    .slice(0, 6)
    .map((w) => w[0])
    .join("")
}

function extractMaxSequence(ids: (string | null | undefined)[], prefix: string): number {
  let max = 0
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`^${escaped}(\\d+)$`, "i")
  for (const val of ids) {
    if (!val) continue
    const match = val.trim().match(regex)
    if (match) {
      const n = parseInt(match[1], 10)
      if (!isNaN(n) && n > max) max = n
    }
  }
  return max
}

/**
 * Generates an ascending smart Quotation ID for a client:
 * e.g., "wco-q-1", "wco-q-2", "wco-q-3" for WEST COAST OPTILINKS
 */
export async function generateSmartQuotationId(clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  })

  const initials = getCompanyInitials(client?.name || "", "qt")
  const prefix = `${initials}-q-`

  const [clientCount, matchingQuotes] = await Promise.all([
    prisma.quotation.count({ where: { clientId } }),
    prisma.quotation.findMany({
      where: { id: { startsWith: prefix } },
      select: { id: true },
    }),
  ])

  const maxExisting = extractMaxSequence(
    matchingQuotes.map((q) => q.id),
    prefix
  )
  let nextNum = Math.max(clientCount, maxExisting) + 1

  while (true) {
    const candidate = `${prefix}${nextNum}`
    const exists = await prisma.quotation.findUnique({
      where: { id: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
    nextNum++
  }
}

/**
 * Generates an ascending smart Purchase Order ID & PO Number for a supplier:
 * e.g., id: "wco-po-1", poNumber: "WCO-PO-1"
 */
export async function generateSmartPoId(
  supplierId: string
): Promise<{ id: string; poNumber: string }> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { name: true },
  })

  const initials = getCompanyInitials(supplier?.name || "", "sup")
  const prefix = `${initials}-po-`

  const [supplierPoCount, matchingPos] = await Promise.all([
    prisma.purchaseOrder.count({ where: { supplierId } }),
    prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { id: { startsWith: prefix } },
          { poNumber: { startsWith: prefix.toUpperCase() } },
        ],
      },
      select: { id: true, poNumber: true },
    }),
  ])

  const maxById = extractMaxSequence(
    matchingPos.map((p) => p.id),
    prefix
  )
  const maxByPoNum = extractMaxSequence(
    matchingPos.map((p) => p.poNumber),
    prefix
  )
  let nextNum = Math.max(supplierPoCount, maxById, maxByPoNum) + 1

  while (true) {
    const candidateId = `${prefix}${nextNum}`
    const candidatePoNum = candidateId.toUpperCase()
    const [existsId, existsNum] = await Promise.all([
      prisma.purchaseOrder.findUnique({ where: { id: candidateId }, select: { id: true } }),
      prisma.purchaseOrder.findUnique({
        where: { poNumber: candidatePoNum },
        select: { id: true },
      }),
    ])
    if (!existsId && !existsNum) {
      return { id: candidateId, poNumber: candidatePoNum }
    }
    nextNum++
  }
}

/**
 * Generates an ascending smart RFQ ID:
 * - Vendor RFQ: "{supplierInitials}-rfq-1"
 * - Public RFQ: "pub-rfq-1"
 */
export async function generateSmartRfqId(
  supplierId?: string | null,
  isPublic?: boolean
): Promise<string> {
  let initials = "pub"
  if (!isPublic && supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { name: true },
    })
    initials = getCompanyInitials(supplier?.name || "", "rfq")
  }

  const prefix = `${initials}-rfq-`

  const [scopeCount, matchingRfqs] = await Promise.all([
    !isPublic && supplierId
      ? prisma.rfq.count({ where: { supplierId } })
      : prisma.rfq.count({ where: { isPublic: true } }),
    prisma.rfq.findMany({
      where: { id: { startsWith: prefix } },
      select: { id: true },
    }),
  ])

  const maxExisting = extractMaxSequence(
    matchingRfqs.map((r) => r.id),
    prefix
  )
  let nextNum = Math.max(scopeCount, maxExisting) + 1

  while (true) {
    const candidate = `${prefix}${nextNum}`
    const exists = await prisma.rfq.findUnique({
      where: { id: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
    nextNum++
  }
}

/**
 * Generates an ascending smart COC ID & Number for a client:
 * e.g., id: "wco-coc-1", cocNumber: "WCO-COC-1"
 */
export async function generateSmartCocId(
  clientId: string
): Promise<{ id: string; cocNumber: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  })

  const initials = getCompanyInitials(client?.name || "", "cli")
  const prefix = `${initials}-coc-`

  const [clientCocCount, matchingCocs] = await Promise.all([
    prisma.certificateOfConformance.count({ where: { clientId } }),
    prisma.certificateOfConformance.findMany({
      where: {
        OR: [
          { id: { startsWith: prefix } },
          { cocNumber: { startsWith: prefix.toUpperCase() } },
        ],
      },
      select: { id: true, cocNumber: true },
    }),
  ])

  const maxById = extractMaxSequence(
    matchingCocs.map((c) => c.id),
    prefix
  )
  const maxByNum = extractMaxSequence(
    matchingCocs.map((c) => c.cocNumber),
    prefix
  )
  let nextNum = Math.max(clientCocCount, maxById, maxByNum) + 1

  while (true) {
    const candidateId = `${prefix}${nextNum}`
    const candidateCocNum = candidateId.toUpperCase()
    const [existsId, existsNum] = await Promise.all([
      prisma.certificateOfConformance.findUnique({
        where: { id: candidateId },
        select: { id: true },
      }),
      prisma.certificateOfConformance.findUnique({
        where: { cocNumber: candidateCocNum },
        select: { id: true },
      }),
    ])
    if (!existsId && !existsNum) {
      return { id: candidateId, cocNumber: candidateCocNum }
    }
    nextNum++
  }
}

/**
 * Generates an ascending smart Direct Purchase ID for a supplier:
 * e.g., "wco-pur-1"
 */
export async function generateSmartPurchaseId(supplierId: string): Promise<string> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { name: true },
  })

  const initials = getCompanyInitials(supplier?.name || "", "sup")
  const prefix = `${initials}-pur-`

  const [supplierPurCount, matchingPurchases] = await Promise.all([
    prisma.purchase.count({ where: { supplierId } }),
    prisma.purchase.findMany({
      where: { id: { startsWith: prefix } },
      select: { id: true },
    }),
  ])

  const maxExisting = extractMaxSequence(
    matchingPurchases.map((p) => p.id),
    prefix
  )
  let nextNum = Math.max(supplierPurCount, maxExisting) + 1

  while (true) {
    const candidate = `${prefix}${nextNum}`
    const exists = await prisma.purchase.findUnique({
      where: { id: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
    nextNum++
  }
}

/**
 * Generates a clean smart Client ID: e.g., "wco" or "wco-2"
 */
export async function generateSmartClientId(clientName: string): Promise<string> {
  const initials = getCompanyInitials(clientName, "cli")
  const existsBase = await prisma.client.findUnique({
    where: { id: initials },
    select: { id: true },
  })
  if (!existsBase) return initials

  let nextNum = 2
  while (true) {
    const candidate = `${initials}-${nextNum}`
    const exists = await prisma.client.findUnique({
      where: { id: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
    nextNum++
  }
}

/**
 * Generates a clean smart Supplier ID: e.g., "wco" or "wco-2"
 */
export async function generateSmartSupplierId(supplierName: string): Promise<string> {
  const initials = getCompanyInitials(supplierName, "sup")
  const existsBase = await prisma.supplier.findUnique({
    where: { id: initials },
    select: { id: true },
  })
  if (!existsBase) return initials

  let nextNum = 2
  while (true) {
    const candidate = `${initials}-${nextNum}`
    const exists = await prisma.supplier.findUnique({
      where: { id: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
    nextNum++
  }
}

