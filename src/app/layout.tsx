import type { Metadata } from "next"
import { Outfit, Montserrat } from "next/font/google"
import "./globals.css"

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
})

const montserrat = Montserrat({ 
  subsets: ["latin"],
  variable: "--font-montserrat",
})

export const metadata: Metadata = {
  title: {
    template: "%s | Radiant Industrial Company",
    default: "Radiant Industrial Company",
  },
  description: "Internal Management Application",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${montserrat.variable} font-sans bg-zinc-950 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
