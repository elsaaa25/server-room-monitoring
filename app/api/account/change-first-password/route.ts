import { compare, hash } from "bcryptjs"
import { z } from "zod"

import { auth } from "@/auth"
import { createPasswordConfirmationToken } from "@/lib/account-token"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"

export const runtime = "nodejs"

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(12, "Password baru minimal 12 karakter.")
      .max(128)
      .regex(/[A-Z]/, "Password harus memiliki huruf besar.")
      .regex(/[a-z]/, "Password harus memiliki huruf kecil.")
      .regex(/[0-9]/, "Password harus memiliki angka.")
      .regex(
        /[^A-Za-z0-9]/,
        "Password harus memiliki karakter khusus.",
      ),
    confirmPassword: z.string(),
  })
  .refine(
    data => data.newPassword === data.confirmPassword,
    {
      message: "Konfirmasi password tidak sama.",
      path: ["confirmPassword"],
    },
  )

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json(
      {
        success: false,
        message: "Sesi login tidak ditemukan.",
      },
      { status: 401 },
    )
  }

  try {
    const body = await request.json()
    const parsed = passwordSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message:
            parsed.error.issues[0]?.message ??
            "Data password tidak valid.",
        },
        { status: 400 },
      )
    }

    const client = await db.connect()

    try {
      await client.query("BEGIN")

      const userResult = await client.query(
        `
          SELECT
            id::text,
            name,
            email,
            password_hash,
            must_change_password
          FROM users
          WHERE id = $1
            AND is_active = TRUE
            AND email_verified_at IS NOT NULL
          LIMIT 1
          FOR UPDATE
        `,
        [session.user.id],
      )

      if (userResult.rowCount === 0) {
        await client.query("ROLLBACK")

        return Response.json(
          {
            success: false,
            message: "Akun admin tidak ditemukan.",
          },
          { status: 404 },
        )
      }

      const user = userResult.rows[0]

      if (!user.must_change_password) {
        await client.query("ROLLBACK")

        return Response.json(
          {
            success: false,
            message:
              "Akun tidak lagi memerlukan penggantian password pertama.",
          },
          { status: 400 },
        )
      }

      const currentPasswordValid = await compare(
        parsed.data.currentPassword,
        user.password_hash,
      )

      if (!currentPasswordValid) {
        await client.query("ROLLBACK")

        return Response.json(
          {
            success: false,
            message: "Password sementara tidak sesuai.",
          },
          { status: 400 },
        )
      }

      const sameAsCurrentPassword = await compare(
        parsed.data.newPassword,
        user.password_hash,
      )

      if (sameAsCurrentPassword) {
        await client.query("ROLLBACK")

        return Response.json(
          {
            success: false,
            message:
              "Password baru tidak boleh sama dengan password sementara.",
          },
          { status: 400 },
        )
      }

      const pendingPasswordHash = await hash(
        parsed.data.newPassword,
        12,
      )

      const {
        token,
        tokenHash,
        expiresAt,
      } = createPasswordConfirmationToken()

      await client.query(
        `
          UPDATE users
          SET
            pending_password_hash = $1,
            password_confirmation_token_hash = $2,
            password_confirmation_expires_at = $3,
            updated_at = NOW()
          WHERE id = $4
        `,
        [
          pendingPasswordHash,
          tokenHash,
          expiresAt,
          user.id,
        ],
      )

      const appUrl = process.env.APP_URL?.replace(
        /\/+$/,
        "",
      )

      if (!appUrl) {
        throw new Error("APP_URL belum dikonfigurasi.")
      }

      const confirmationUrl =
        `${appUrl}/konfirmasi-password` +
        `?token=${encodeURIComponent(token)}`

      await sendEmail({
        to: user.email,
        subject:
          "Konfirmasi Perubahan Password Monitoring Room",
        html: `
          <div
            style="
              max-width: 600px;
              margin: 0 auto;
              padding: 24px;
              font-family: Arial, sans-serif;
              color: #0f172a;
              line-height: 1.6;
            "
          >
            <h2>Konfirmasi Perubahan Password</h2>

            <p>Halo ${escapeHtml(user.name)},</p>

            <p>
              Kami menerima permintaan penggantian password
              untuk akun administrator Monitoring Room.
            </p>

            <p>
              Klik tombol berikut untuk mengaktifkan password
              baru:
            </p>

            <p style="margin: 28px 0;">
              <a
                href="${confirmationUrl}"
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
                Konfirmasi Password Baru
              </a>
            </p>

            <p>
              Tautan berlaku selama
              <strong>30 menit</strong> dan hanya dapat
              digunakan satu kali.
            </p>

            <p style="color: #64748b; font-size: 13px;">
              Abaikan pesan ini apabila Anda tidak melakukan
              penggantian password.
            </p>
          </div>
        `,
      })

      await client.query("COMMIT")

      return Response.json({
        success: true,
        message:
          "Tautan konfirmasi telah dikirim ke email Anda.",
      })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error(
      "Gagal memproses password pertama:",
      error,
    )

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memproses password.",
      },
      { status: 500 },
    )
  }
}