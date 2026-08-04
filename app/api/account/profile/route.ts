import { auth } from "@/auth"
import { db } from "@/lib/db"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      2,
      "Nama minimal terdiri dari 2 karakter.",
    )
    .max(
      100,
      "Nama maksimal terdiri dari 100 karakter.",
    ),
})

type DatabaseUser = {
  id: string
  name: string
  email: string
  role: "OPERATOR" | "ADMIN"
  updated_at: Date
}

function normalizeName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
}

function mapUser(user: DatabaseUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    updatedAt: user.updated_at,
  }
}

export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      return Response.json(
        {
          success: false,
          message:
            "Sesi login tidak ditemukan.",
        },
        {
          status: 401,
        },
      )
    }

    const result =
      await db.query<DatabaseUser>(
        `
          SELECT
            id::text,
            name,
            email,
            role,
            updated_at
          FROM users
          WHERE id = $1
            AND is_active = TRUE
          LIMIT 1
        `,
        [userId],
      )

    const user = result.rows[0]

    if (!user) {
      return Response.json(
        {
          success: false,
          message:
            "Data pengguna tidak ditemukan.",
        },
        {
          status: 404,
        },
      )
    }

    return Response.json({
      success: true,
      data: mapUser(user),
    })
  } catch (error) {
    console.error(
      "Gagal mengambil profil:",
      error,
    )

    return Response.json(
      {
        success: false,
        message:
          "Terjadi kesalahan saat mengambil profil.",
      },
      {
        status: 500,
      },
    )
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      return Response.json(
        {
          success: false,
          message:
            "Sesi login tidak ditemukan.",
        },
        {
          status: 401,
        },
      )
    }

    const body =
      await request.json().catch(
        () => null,
      )

    const rawName =
      typeof body?.name === "string"
        ? normalizeName(body.name)
        : ""

    const parsed =
      updateProfileSchema.safeParse({
        name: rawName,
      })

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message:
            parsed.error.issues[0]
              ?.message ??
            "Nama pengguna tidak valid.",
        },
        {
          status: 400,
        },
      )
    }

    const result =
      await db.query<DatabaseUser>(
        `
          UPDATE users
          SET
            name = $1,
            updated_at = NOW()
          WHERE id = $2
            AND is_active = TRUE
          RETURNING
            id::text,
            name,
            email,
            role,
            updated_at
        `,
        [
          parsed.data.name,
          userId,
        ],
      )

    const user = result.rows[0]

    if (!user) {
      return Response.json(
        {
          success: false,
          message:
            "Pengguna tidak ditemukan atau sudah dinonaktifkan.",
        },
        {
          status: 404,
        },
      )
    }

    return Response.json({
      success: true,
      message:
        "Nama pengguna berhasil diperbarui.",
      data: mapUser(user),
    })
  } catch (error) {
    console.error(
      "Gagal memperbarui profil:",
      error,
    )

    return Response.json(
      {
        success: false,
        message:
          "Terjadi kesalahan saat memperbarui profil.",
      },
      {
        status: 500,
      },
    )
  }
}