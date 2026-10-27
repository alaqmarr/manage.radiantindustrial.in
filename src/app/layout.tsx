import type { Metadata } from "next"
import { Outfit, Montserrat } from "next/font/google"
import "./globals.css"
import { Toaster } from "sileo"

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
  description: "Enterprise Resource & Supply Chain Management System",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${montserrat.variable} font-sans bg-slate-50 text-slate-900 min-h-screen antialiased selection:bg-orange-100 selection:text-orange-900`}>
        {children}
        <Toaster
          theme="light"
          position="top-center"
          offset={16}
        />
      </body>
    </html>
  )
}
