import { createHash, randomBytes } from "node:crypto"

import pg from "pg"
import { Resend } from "resend"

const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error(
    "Masukkan alamat email.\n" +
      "Contoh:\n" +
      "node --env-file=.env.local scripts/resend-verification.mjs airnavbwx@gmail.com",
  )

  process.exitCode = 1
} else {
  const requiredEnvironmentVariables = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "APP_URL",
  ]

  const missingEnvironmentVariable =
    requiredEnvironmentVariables.find(
      key => !process.env[key]?.trim(),
    )

  if (missingEnvironmentVariable) {
    console.error(
      `${missingEnvironmentVariable} belum diisi di .env.local`,
    )

    process.exitCode = 1
  } else {
    const pool = new pg.Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 10_000,
    })

    const resend = new Resend(
      process.env.RESEND_API_KEY,
    )

    const client = await pool.connect()

    try {
      await client.query("BEGIN")

      const userResult = await client.query(
        `
          SELECT
            id::text,
            name,
            email,
            email_verified_at
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
          FOR UPDATE
        `,
        [email],
      )

      if (userResult.rowCount === 0) {
        throw new Error("USER_NOT_FOUND")
      }

      const user = userResult.rows[0]

      if (user.email_verified_at) {
        throw new Error("EMAIL_ALREADY_VERIFIED")
      }

      // Token asli dikirim melalui email.
      const verificationToken = randomBytes(32).toString(
        "hex",
      )

      // Database hanya menyimpan hash token.
      const verificationTokenHash = createHash("sha256")
        .update(verificationToken)
        .digest("hex")

      // Tautan berlaku selama 60 menit.
      const verificationExpiresAt = new Date(
        Date.now() + 60 * 60 * 1000,
      )

      await client.query(
        `
          UPDATE users
          SET
            is_active = FALSE,
            email_verification_token_hash = $1,
            email_verification_expires_at = $2,
            updated_at = NOW()
          WHERE id = $3
        `,
        [
          verificationTokenHash,
          verificationExpiresAt,
          user.id,
        ],
      )

      const appUrl = process.env.APP_URL.replace(
        /\/+$/,
        "",
      )

      const verificationUrl =
        `${appUrl}/verifikasi-email` +
        `?token=${encodeURIComponent(verificationToken)}`

      const { data, error } =
        await resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: [user.email],
          subject:
            "Tautan Baru Verifikasi Akun Monitoring Room",
          html: `
            <div
              style="
                max-width: 600px;
                margin: 0 auto;
                padding: 24px;
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #0f172a;
              "
            >
              <h2>Verifikasi Akun Admin</h2>

              <p>Halo ${escapeHtml(user.name)},</p>

              <p>
                Tautan verifikasi sebelumnya sudah tidak
                berlaku. Gunakan tautan baru berikut untuk
                memverifikasi akun Anda.
              </p>

              <p style="margin: 28px 0;">
                <a
                  href="${verificationUrl}"
                  style="
                    display: inline-block;
                    padding: 12px 20px;
                    border-radius: 8px;
                    background: #005a9c;
                    color: white;
                    text-decoration: none;
                    font-weight: 600;
                  "
                >
                  Verifikasi Email
                </a>
              </p>

              <p>
                Tautan ini berlaku selama
                <strong>60 menit</strong> dan hanya dapat
                digunakan satu kali.
              </p>

              <p style="color: #64748b; font-size: 13px;">
                Abaikan pesan ini apabila Anda tidak meminta
                tautan verifikasi baru.
              </p>
            </div>
          `,
        })

      if (error) {
        throw new Error(
          `RESEND_ERROR:${error.message}`,
        )
      }

      await client.query("COMMIT")

      console.log("")
      console.log(
        "Tautan verifikasi baru berhasil dikirim.",
      )
      console.log(`Email     : ${user.email}`)
      console.log(
        `Kedaluwarsa: ${verificationExpiresAt.toLocaleString(
          "id-ID",
          {
            timeZone: "Asia/Jakarta",
          },
        )} WIB`,
      )
      console.log(`Email ID  : ${data?.id ?? "-"}`)
      console.log("")
    } catch (error) {
      await client.query("ROLLBACK")

      const message =
        error instanceof Error
          ? error.message
          : String(error)

      if (message === "USER_NOT_FOUND") {
        console.error(
          `Akun ${email} tidak ditemukan.`,
        )
      } else if (
        message === "EMAIL_ALREADY_VERIFIED"
      ) {
        console.error(
          "Email akun tersebut sudah diverifikasi.",
        )
      } else if (
        message.startsWith("RESEND_ERROR:")
      ) {
        console.error(
          "Email verifikasi gagal dikirim:",
          message.replace("RESEND_ERROR:", ""),
        )
      } else {
        console.error(
          "Gagal membuat tautan verifikasi baru:",
          message,
        )
      }

      process.exitCode = 1
    } finally {
      client.release()
      await pool.end()
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}