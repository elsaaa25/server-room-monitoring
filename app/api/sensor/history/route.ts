import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    // Hanya pengguna yang sudah login
    // yang dapat melihat riwayat.
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(request.url)

    const sensorId = searchParams.get("sensorId")
    const hoursStr = searchParams.get("hours")
    const date = searchParams.get("date")
    const limitStr = searchParams.get("limit")

    let query = `
      SELECT
        id,
        sensor_id AS "sensorId",
        temperature::float8 AS temperature,
        voltage::float8 AS voltage,
        recorded_at AS "recordedAt"
      FROM sensor_readings
      WHERE 1 = 1
    `

    const params: Array<string | number> = []
    let paramIndex = 1

    // Filter berdasarkan sensor.
    if (sensorId) {
      query += `
        AND sensor_id = $${paramIndex}
      `

      params.push(sensorId)
      paramIndex++
    }

    // Filter berdasarkan tanggal di zona waktu Jakarta.
    if (date) {
      const isValidDate =
        /^\d{4}-\d{2}-\d{2}$/.test(date)

      if (!isValidDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Format tanggal harus YYYY-MM-DD",
          },
          { status: 400 },
        )
      }

      query += `
        AND (
          recorded_at
          AT TIME ZONE 'Asia/Jakarta'
        )::date = $${paramIndex}::date
      `

      params.push(date)
      paramIndex++
    } else if (hoursStr) {
      // Filter berdasarkan jumlah jam terakhir.
      const hours = Number.parseInt(
        hoursStr,
        10,
      )

      if (
        !Number.isInteger(hours) ||
        hours <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Parameter hours tidak valid",
          },
          { status: 400 },
        )
      }

      query += `
        AND recorded_at >=
          NOW() - (
            $${paramIndex}::int *
            INTERVAL '1 hour'
          )
      `

      params.push(hours)
      paramIndex++
    }

    query += `
      ORDER BY recorded_at DESC
    `

    // Batasi jumlah hasil.
    if (limitStr) {
      const limit = Number.parseInt(
        limitStr,
        10,
      )

      if (
        !Number.isInteger(limit) ||
        limit <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Parameter limit tidak valid",
          },
          { status: 400 },
        )
      }

      // Mencegah permintaan data terlalu besar.
      const safeLimit = Math.min(
        limit,
        5000,
      )

      query += `
        LIMIT $${paramIndex}::int
      `

      params.push(safeLimit)
    }

    const result = await db.query(
      query,
      params,
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
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan yang tidak diketahui"

    console.error(
      "Gagal mengambil data historis sensor:",
      error,
    )

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data",
        details: message,
      },
      { status: 500 },
    )
  }
}