"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import nodemailer from "nodemailer"

export async function sendEmailAction({ to, subject, html }: { to: string[], subject: string, html: string }) {
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

    if (!to || to.length === 0) {
      return { error: "No valid recipient email addresses provided." }
    }

    // Send emails sequentially with a 1-second delay to avoid rate limiting
    const results = [];
    for (const email of to) {
      try {
        await transporter.sendMail({
          from: `"${settings.companyName}" <${settings.smtpEmail}>`,
          to: email,
          subject: subject || `Message from ${settings.companyName}`,
          html: html,
        })
        results.push({ email, status: 'success' })
      } catch (err: any) {
        console.error(`Failed to send to ${email}:`, err)
        results.push({ email, status: 'failed', error: err.message || 'Unknown error' })
      }
      
      // 1-second delay between emails, except after the last one
      if (email !== to[to.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { success: true, results }
  } catch (error: any) {
    console.error("Send Email Error:", error)
    return { error: error.message || "Failed to send email. Please check your SMTP credentials." }
  }
}
