import { Resend } from "resend"

const emailTujuan = process.argv[2]?.trim()
const apiKey = process.env.RESEND_API_KEY?.trim()
const emailFrom = process.env.EMAIL_FROM?.trim()

if (!emailTujuan) {
  console.error("Email tujuan belum dimasukkan.")
  console.error(
    "Contoh: node --env-file=.env.local scripts/test-email.mjs email@gmail.com",
  )
  process.exit(1)
}

if (!apiKey) {
  console.error("RESEND_API_KEY belum terbaca dari .env.local")
  process.exit(1)
}

if (!emailFrom) {
  console.error("EMAIL_FROM belum terbaca dari .env.local")
  process.exit(1)
}

const resend = new Resend(apiKey)

try {
  console.log(`Mengirim email ke ${emailTujuan}...`)

  const { data, error } = await resend.emails.send({
    from: emailFrom,
    to: [emailTujuan],
    subject: "Tes Email Monitoring Room",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Email berhasil dikirim</h2>
        <p>
          Ini adalah email pengujian dari aplikasi Monitoring Ruang Server.
        </p>
        <p>
          Konfigurasi Resend sudah berjalan dengan benar.
        </p>
      </div>
    `,
  })

  if (error) {
    throw new Error(error.message)
  }

  console.log("Email berhasil dikirim.")
  console.log("Email ID:", data?.id ?? "-")
} catch (error) {
  console.error(
    "Email gagal dikirim:",
    error instanceof Error ? error.message : error,
  )
  process.exit(1)
}