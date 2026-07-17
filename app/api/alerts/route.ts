import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/lib/db"

export const runtime = "nodejs"

const acknowledgeSchema = z.union([
  z.object({
    id: z.number().int().positive(),
  }),
  z.object({
    all: z.literal(true),
  }),
])

export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      )
    }

    const url = new URL(request.url)
    const requestedLimit = Number(url.searchParams.get("limit") ?? 200)
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500)
      : 200

    const status = url.searchParams.get("status")
    const level = url.searchParams.get("level")

    const values: Array<string | number> = []
    const conditions: string[] = []

    if (status === "Aktif" || status === "Ditangani") {
      values.push(status)
      conditions.push(`a.status = $${values.length}`)
    }

    if (level === "Waspada" || level === "Bahaya") {
      values.push(level)
      conditions.push(`a.level = $${values.length}`)
    }

    values.push(limit)

    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : ""

    const result = await db.query(
      `
        SELECT
          a.id,
          a.sensor_id AS "sensorId",
          a.level,
          a.status,
          a.temperature::float8 AS temperature,
          a.title,
          a.detail,
          a.created_at AS "createdAt",
          a.acknowledged_at AS "acknowledgedAt",
          a.resolved_at AS "resolvedAt",
          u.name AS "handledByName"
        FROM temperature_alerts a
        LEFT JOIN users u
          ON u.id = a.handled_by
        ${where}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $${values.length}
      `,
      values,
    )

    return NextResponse.json(
      {
        success: true,
        data: result.rows,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    console.error("Gagal mengambil data peringatan:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data peringatan",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      )
    }

    const body: unknown = await request.json()
    const parsed = acknowledgeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Permintaan tidak valid",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      )
    }

    const userId = session.user.id

    const result =
      "id" in parsed.data
        ? await db.query(
            `
              UPDATE temperature_alerts
              SET
                status = 'Ditangani',
                acknowledged_at = COALESCE(acknowledged_at, NOW()),
                handled_by = COALESCE(handled_by, $2::uuid)
              WHERE id = $1
                AND status = 'Aktif'
              RETURNING id
            `,
            [parsed.data.id, userId],
          )
        : await db.query(
            `
              UPDATE temperature_alerts
              SET
                status = 'Ditangani',
                acknowledged_at = COALESCE(acknowledged_at, NOW()),
                handled_by = COALESCE(handled_by, $1::uuid)
              WHERE status = 'Aktif'
              RETURNING id
            `,
            [userId],
          )

    return NextResponse.json({
      success: true,
      message:
        result.rowCount === 0
          ? "Tidak ada peringatan aktif yang perlu ditangani."
          : `${result.rowCount} peringatan berhasil ditandai sebagai ditangani.`,
      updated: result.rowCount ?? 0,
    })
  } catch (error) {
    console.error("Gagal menangani peringatan:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Gagal memperbarui peringatan",
      },
      { status: 500 },
    )
  }
}