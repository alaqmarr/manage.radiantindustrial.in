"use client"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export function GlobalModals({
  suppliers,
  products
}: {
  suppliers: any[]
  products: any[]
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const action = searchParams.get("action")

  const close = () => {
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.delete("action")
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false })
  }

  return (
    <>
      {/* Modals are now rendered within their respective pages */}
    </>
  )
}
