import { prisma } from '../src/lib/prisma'

async function main() {
  const result = await prisma.payment.updateMany({
    where: { poId: { not: null } },
    data: { type: 'OUT' }
  })
  console.log(`Updated ${result.count} payments to type OUT`)
  
  const resultIn = await prisma.payment.updateMany({
    where: { quotationId: { not: null } },
    data: { type: 'IN' }
  })
  console.log(`Updated ${resultIn.count} payments to type IN`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
