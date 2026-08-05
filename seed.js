const { PrismaClient } = require('@prisma/client')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3(new Database("./dev.db")),
})

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: hashedPassword
    },
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword
    }
  })
  console.log({ user })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
