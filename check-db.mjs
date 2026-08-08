import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.companySettings.findUnique({where: {id: 'default'}});
  console.log("BOTTOM DETAILS:");
  console.log(s.bottomDetails);
}
main().catch(console.error).finally(() => prisma.$disconnect());
