import "server-only"

import { Resend } from "resend"

type SendEmailOptions = {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY belum dikonfigurasi di .env.local",
    )
  }

  if (!from) {
    throw new Error(
      "EMAIL_FROM belum dikonfigurasi di .env.local",
    )
  }

  const resend = new Resend(apiKey)

  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })

  if (error) {
    throw new Error(
      `Gagal mengirim email: ${error.message}`,
    )
  }

  return data
}