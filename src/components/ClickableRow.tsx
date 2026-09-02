"use client"

import { useRouter } from "next/navigation"
import React from "react"

export function ClickableRow({ 
  href, 
  children, 
  className 
}: { 
  href: string
  children: React.ReactNode
  className?: string 
}) {
  const router = useRouter()

  return (
    <tr
      className={className}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const target = e.target as HTMLElement
          if (
            target.closest('input[type="checkbox"]') ||
            target.closest('button') ||
            target.closest('a')
          ) {
            return
          }
          router.push(href)
        }
      }}
      onClick={(e) => {
        // Prevent navigation if clicking on a checkbox, button, or link
        const target = e.target as HTMLElement
        if (
          target.closest('input[type="checkbox"]') ||
          target.closest('button') ||
          target.closest('a')
        ) {
          return
        }
        router.push(href)
      }}
    >
      {children}
    </tr>
  )
}
