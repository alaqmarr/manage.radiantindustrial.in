"use client"
import { useEffect } from "react"

export function DisableNumberInputScroll() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement?.tagName === "INPUT" && (document.activeElement as HTMLInputElement).type === "number") {
        (document.activeElement as HTMLElement).blur()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" && (document.activeElement as HTMLInputElement).type === "number") {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault()
        }
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: true })
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("wheel", handleWheel)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return null
}
