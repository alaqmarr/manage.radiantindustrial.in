import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminCount = await prisma.user.count({
    where: { role: "ADMIN" }
  })

  if (adminCount === 0) {
    redirect("/setup")
  }

  return <>{children}</>
}
