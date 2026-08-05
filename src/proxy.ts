import NextAuth from "next-auth"
import authConfig from "./auth.config"

// We split the config to support Edge middleware if needed in the future
export default NextAuth(authConfig).auth

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
