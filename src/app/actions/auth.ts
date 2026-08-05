"use server"
import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function loginAction(formData: FormData) {
  try {
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    await signIn("credentials", { email, password, redirectTo: "/" })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials." }
        default:
          return { error: "Something went wrong." }
      }
    }
    throw error
  }
}
