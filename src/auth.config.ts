import type { NextAuthConfig } from "next-auth"

export default {
  secret: process.env.AUTH_SECRET,
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthRoute = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/setup")
      
      if (isAuthRoute) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl))
        return true
      }
      
      if (!isLoggedIn) return false
      return true
    },
  },
} satisfies NextAuthConfig
