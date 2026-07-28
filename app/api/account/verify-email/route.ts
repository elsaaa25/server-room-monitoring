import { z } from "zod"

import { hashAccountToken } from "@/lib/account-token"
import { db } from "@/lib/db"

export const runtime = "nodejs"

const verificationSchema = z.object({
  token: z.string().min(64).max(128),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = verificationSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message: "Token verifikasi tidak valid.",
        },
        { status: 400 },
      )
    }

    const tokenHash = hashAccountToken(parsed.data.token)

    const result = await db.query(
      `
        UPDATE users
        SET
          email_verified_at = NOW(),
          is_active = TRUE,
          email_verification_token_hash = NULL,
          email_verification_expires_at = NULL,
          updated_at = NOW()
        WHERE email_verification_token_hash = $1
          AND email_verification_expires_at > NOW()
          AND email_verified_at IS NULL
        RETURNING
          id::text,
          email,
          must_change_password
      `,
      [tokenHash],
    )

    if (result.rowCount === 0) {
      return Response.json(
        {
          success: false,
          message:
            "Tautan verifikasi tidak valid, sudah digunakan, atau kedaluwarsa.",
        },
        { status: 400 },
      )
    }

    return Response.json({
      success: true,
      message:
        "Email berhasil diverifikasi. Silakan login menggunakan password sementara.",
      mustChangePassword: result.rows[0].must_change_password,
    })
  } catch (error) {
    console.error("Gagal memverifikasi email:", error)

    return Response.json(
      {
        success: false,
        message: "Terjadi kesalahan saat memverifikasi email.",
      },
      { status: 500 },
    )
  }
}