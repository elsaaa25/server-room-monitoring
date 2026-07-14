import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/auth"

export async function GET(request: Request) {
  try {
    // Hanya pengguna yang sudah login yang dapat melihat riwayat
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
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
        temperature,
        voltage,
        recorded_at AS "recordedAt"
      FROM sensor_readings
      WHERE 1 = 1
    `

    const params: unknown[] = []
    let paramIndex = 1

    // Filter berdasarkan sensor
    if (sensorId) {
      query += ` AND sensor_id = $${paramIndex}`
      params.push(sensorId)
      paramIndex++
    }

    // Filter berdasarkan tanggal tertentu
    if (date) {
      query += `
        AND DATE(
          recorded_at
          AT TIME ZONE 'UTC'
          AT TIME ZONE 'Asia/Jakarta'
        ) = $${paramIndex}::date
      `

      params.push(date)
      paramIndex++
    } else if (hoursStr) {
      // Filter berdasarkan jumlah jam terakhir
      const hours = Number.parseInt(hoursStr, 10)

      if (Number.isInteger(hours) && hours > 0) {
        query += `
          AND recorded_at >=
            NOW() - ($${paramIndex}::int * INTERVAL '1 hour')
        `

        params.push(hours)
        paramIndex++
      }
    }

    query += ` ORDER BY recorded_at DESC`

    // Batasi jumlah hasil
    if (limitStr) {
      const limit = Number.parseInt(limitStr, 10)

      if (Number.isInteger(limit) && limit > 0) {
        query += ` LIMIT $${paramIndex}::int`
        params.push(limit)
      }
    }

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
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
        error: "Gagal mengambil data",
        details: message,
      },
      { status: 500 },
    )
  }
}