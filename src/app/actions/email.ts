"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import nodemailer from "nodemailer"

export async function sendEmailAction({ to, subject, html }: { to: string, subject: string, html: string }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" }
    })

    if (!settings?.smtpEmail || !settings?.smtpPassword) {
      return { error: "SMTP credentials are not configured in Company Settings. Please update them first." }
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: settings.smtpEmail,
        pass: settings.smtpPassword,
      },
    })

    const emails = to.split(",").map(e => e.trim()).filter(Boolean)

    if (emails.length === 0) {
      return { error: "No valid recipient email addresses provided." }
    }

    // Send emails individually
    const results = await Promise.allSettled(
      emails.map(email => {
        return transporter.sendMail({
          from: `"${settings.companyName}" <${settings.smtpEmail}>`,
          to: email,
          subject: subject || `Message from ${settings.companyName}`,
          html: html,
        })
      })
    )

    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
      console.error("Some emails failed to send:", failed)
      return { error: `Failed to send to ${failed.length} recipient(s). Check logs.` }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Send Email Error:", error)
    return { error: error.message || "Failed to send email. Please check your SMTP credentials." }
  }
}
