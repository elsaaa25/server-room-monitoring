import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

export const runtime = "nodejs"

const readingSchema = z.object({
  sensorId: z.literal("TEMP-L4"),
  temperature: z
    .number()
    .finite()
    .min(-40)
    .max(100),
  voltage: z
    .number()
    .finite()
    .min(0)
    .max(10)
    .optional(),
})

export async function POST(request: Request) {
  try {
    const sensorApiKey = process.env.SENSOR_API_KEY

    if (!sensorApiKey) {
      console.error(
        "SENSOR_API_KEY belum tersedia pada environment server.",
      )

      return NextResponse.json(
        { error: "Konfigurasi server belum lengkap" },
        { status: 500 },
      )
    }

    const authorization =
      request.headers.get("authorization")

    if (authorization !== `Bearer ${sensorApiKey}`) {
      return NextResponse.json(
        { error: "Perangkat tidak diizinkan" },
        { status: 401 },
      )
    }

    const body: unknown = await request.json()
    const parsed = readingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Data sensor tidak valid",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      )
    }

    const {
      sensorId,
      temperature,
      voltage,
    } = parsed.data

    const result = await db.query(
      `
        INSERT INTO sensor_readings (
          sensor_id,
          temperature,
          voltage,
          recorded_at
        )
        VALUES ($1, $2, $3, NOW())
        RETURNING
          id,
          sensor_id AS "sensorId",
          temperature,
          voltage,
          recorded_at AS "recordedAt"
      `,
      [
        sensorId,
        temperature,
        voltage ?? null,
      ],
    )

    return NextResponse.json(
      {
        success: true,
        message: "Data suhu lantai 4 berhasil disimpan.",
        data: result.rows[0],
      },
      { status: 201 },
    )
  } catch (error) {
    console.error(
      "Gagal menyimpan data sensor:",
      error,
    )

    const message =
      error instanceof Error
        ? error.message
        : "Kesalahan tidak diketahui"

    return NextResponse.json(
      {
        error: "Gagal menyimpan data sensor",
        details:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      { status: 500 },
    )
  }
}
