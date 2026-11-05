import type { NextAuthConfig } from "next-auth"

export default {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      // Public vendor RFQ bidding portal — never require authentication
      if (pathname.startsWith("/vendor-quote")) {
        return true
      }

      const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/setup")

      if (isAuthRoute) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl))
        return true
      }

      if (!isLoggedIn) return false
      return true
    },
  },
} satisfies NextAuthConfig
