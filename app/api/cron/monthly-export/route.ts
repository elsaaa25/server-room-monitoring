import { db } from "@/lib/db"
import { uploadExcelToGoogleDrive } from "@/lib/google-drive"
import {
  createMonthlyExcel,
  type MonthlySensorReading,
} from "@/lib/monthly-export"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  // ── 1. Validasi CRON_SECRET ─────────────────────────────────────
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
  }

  try {
    // ── 2. Tentukan rentang bulan yang akan diekspor ───────────────
    //    Default: bulan lalu (UTC+7 / WIB)
    //    Opsional: bisa di-override lewat query ?month=YYYY-MM
    const url = new URL(request.url)
    const monthParam = url.searchParams.get("month")

    let archiveMonth: string

    if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
      archiveMonth = monthParam
    } else {
      // Hitung bulan lalu dalam WIB (UTC+7)
      const now = new Date()
      const wibOffset = 7 * 60 * 60 * 1000
      const wibNow = new Date(now.getTime() + wibOffset)
      const year = wibNow.getUTCFullYear()
      const month = wibNow.getUTCMonth() // 0-indexed

      // Bulan lalu
      const prevMonth = month === 0 ? 12 : month
      const prevYear = month === 0 ? year - 1 : year

      archiveMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}`
    }

    // ── 3. Hitung batas awal & akhir bulan (WIB → UTC) ────────────
    const [yearStr, monthStr] = archiveMonth.split("-")
    const year = Number(yearStr)
    const month = Number(monthStr) // 1-indexed

    // Awal bulan WIB = tanggal 1 pukul 00:00 WIB = tanggal 1 pukul 17:00 UTC (hari sebelumnya)
    const startUtc = new Date(
      Date.UTC(year, month - 1, 1, 0, 0, 0) - 7 * 60 * 60 * 1000,
    )

    // Awal bulan berikutnya WIB
    const endUtc = new Date(
      Date.UTC(year, month, 1, 0, 0, 0) - 7 * 60 * 60 * 1000,
    )

    // ── 4. Ambil data dari PostgreSQL ─────────────────────────────
    const result = await db.query<{
      id: number
      sensor_id: string
      temperature: string | null
      voltage: string | null
      current: string | null
      recorded_at: Date
    }>(
      `SELECT id, sensor_id, temperature, voltage, current, recorded_at
       FROM sensor_readings
       WHERE recorded_at >= $1 AND recorded_at < $2
       ORDER BY recorded_at ASC`,
      [startUtc.toISOString(), endUtc.toISOString()],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Tidak ada data untuk bulan ${archiveMonth}`,
        archiveMonth,
        rowCount: 0,
      })
    }

    // ── 5. Ubah ke format MonthlySensorReading ────────────────────
    const readings: MonthlySensorReading[] = []

    for (const row of result.rows) {
      const sensorId = row.sensor_id.trim().toUpperCase()

      if (row.temperature !== null) {
        const temp = Number(row.temperature)
        if (Number.isFinite(temp)) {
          readings.push({
            id: `${row.id}-temp`,
            sensorId,
            metric:
              sensorId === "TEMP-L5"
                ? "suhu lantai 5"
                : "suhu lantai 4",
            value: temp,
            unit: "°C",
            recordedAt: row.recorded_at,
          })
        }
      }

      if (row.voltage !== null) {
        const volt = Number(row.voltage)
        if (Number.isFinite(volt)) {
          readings.push({
            id: `${row.id}-volt`,
            sensorId: "VOLT-01",
            metric: "tegangan",
            value: volt,
            unit: "V",
            recordedAt: row.recorded_at,
          })
        }
      }

      if (row.current !== null) {
        const curr = Number(row.current)
        if (Number.isFinite(curr)) {
          readings.push({
            id: `${row.id}-curr`,
            sensorId: "CURRENT-01",
            metric: "arus",
            value: curr,
            unit: "A",
            recordedAt: row.recorded_at,
          })
        }
      }
    }

    // ── 6. Buat file Excel ────────────────────────────────────────
    const fileBuffer = await createMonthlyExcel({
      archiveMonth,
      readings,
    })

    // ── 7. Upload ke Google Drive ─────────────────────────────────
    const fileName = `laporan-monitoring-${archiveMonth}.xlsx`

    const uploadResult = await uploadExcelToGoogleDrive({
      fileName,
      fileBuffer,
    })

    return NextResponse.json({
      success: true,
      message: `Laporan ${archiveMonth} berhasil diunggah ke Google Drive`,
      archiveMonth,
      rowCount: result.rows.length,
      readingCount: readings.length,
      file: {
        id: uploadResult.id,
        name: uploadResult.name,
        webViewLink: uploadResult.webViewLink,
      },
    })
  } catch (error) {
    console.error("Cron monthly-export gagal:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan tidak terduga",
      },
      { status: 500 },
    )
  }
}