import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminCount = await prisma.user.count({
    where: { role: "ADMIN" }
  })

  const session = await auth()
  if (session?.user) {
    redirect("/")
  }

  if (adminCount === 0) {
    redirect("/setup")
  }

  return <>{children}</>
}
