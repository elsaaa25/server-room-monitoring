import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { uploadExcelToGoogleDrive } from "@/lib/google-drive"
import {
  createMonthlyExcel,
  type MonthlySensorReading,
} from "@/lib/monthly-export"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type DatabaseReading = {
  id: number
  sensor_id: string
  temperature: string | null
  voltage: string | null
  current: string | null
  recorded_at: Date
}

function getArchiveMonth(requestUrl: string): string {
  const url = new URL(requestUrl)
  const monthParam = url.searchParams.get("month")

  if (
    monthParam &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)
  ) {
    return monthParam
  }

  const now = new Date()
  const wibOffsetMs = 7 * 60 * 60 * 1000
  const wibNow = new Date(now.getTime() + wibOffsetMs)

  const currentYear = wibNow.getUTCFullYear()
  const currentMonthIndex = wibNow.getUTCMonth()

  const previousMonth =
    currentMonthIndex === 0 ? 12 : currentMonthIndex

  const previousYear =
    currentMonthIndex === 0
      ? currentYear - 1
      : currentYear

  return (
    `${previousYear}-` +
    `${String(previousMonth).padStart(2, "0")}`
  )
}

function getMonthRangeUtc(
  archiveMonth: string,
): {
  startUtc: Date
  endUtc: Date
} {
  const [yearText, monthText] = archiveMonth.split("-")

  const year = Number(yearText)
  const month = Number(monthText)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Bulan arsip tidak valid")
  }

  const wibOffsetMs = 7 * 60 * 60 * 1000

  const startUtc = new Date(
    Date.UTC(year, month - 1, 1, 0, 0, 0) -
      wibOffsetMs,
  )

  const endUtc = new Date(
    Date.UTC(year, month, 1, 0, 0, 0) -
      wibOffsetMs,
  )

  return {
    startUtc,
    endUtc,
  }
}

function mapDatabaseReadings(
  rows: DatabaseReading[],
): MonthlySensorReading[] {
  const readings: MonthlySensorReading[] = []

  for (const row of rows) {
    const sensorId = row.sensor_id.trim().toUpperCase()

    if (row.temperature !== null) {
      const temperature = Number(row.temperature)

      if (Number.isFinite(temperature)) {
        readings.push({
          id: `${row.id}-temp`,
          sensorId,
          metric:
            sensorId === "TEMP-L5"
              ? "suhu lantai 5"
              : "suhu lantai 4",
          value: temperature,
          unit: "°C",
          recordedAt: row.recorded_at,
        })
      }
    }

    if (row.voltage !== null) {
      const voltage = Number(row.voltage)

      if (Number.isFinite(voltage)) {
        readings.push({
          id: `${row.id}-volt`,
          sensorId: "VOLT-01",
          metric: "tegangan",
          value: voltage,
          unit: "V",
          recordedAt: row.recorded_at,
        })
      }
    }

    if (row.current !== null) {
      const current = Number(row.current)

      if (Number.isFinite(current)) {
        readings.push({
          id: `${row.id}-curr`,
          sensorId: "CURRENT-01",
          metric: "arus",
          value: current,
          unit: "A",
          recordedAt: row.recorded_at,
        })
      }
    }
  }

  return readings
}

async function deleteExportedReadings({
  startUtc,
  endUtc,
  expectedRowCount,
}: {
  startUtc: Date
  endUtc: Date
  expectedRowCount: number
}): Promise<number> {
  const client = await db.connect()

  try {
    await client.query("BEGIN")

    const deleteResult = await client.query(
      `
        DELETE FROM sensor_readings
        WHERE recorded_at >= $1
          AND recorded_at < $2
      `,
      [startUtc.toISOString(), endUtc.toISOString()],
    )

    const deletedRowCount = deleteResult.rowCount ?? 0

    if (deletedRowCount !== expectedRowCount) {
      throw new Error(
        "Jumlah data yang akan dihapus berbeda " +
          `dengan hasil export. Export: ${expectedRowCount}, ` +
          `delete: ${deletedRowCount}. ` +
          "Penghapusan dibatalkan.",
      )
    }

    await client.query("COMMIT")

    return deletedRowCount
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (
    !cronSecret ||
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    )
  }

  try {
    const archiveMonth = getArchiveMonth(request.url)
    const { startUtc, endUtc } =
      getMonthRangeUtc(archiveMonth)

    const deleteAfterExport =
      process.env.DELETE_AFTER_MONTHLY_EXPORT ===
      "true"

    const result = await db.query<DatabaseReading>(
      `
        SELECT
          id,
          sensor_id,
          temperature,
          voltage,
          current,
          recorded_at
        FROM sensor_readings
        WHERE recorded_at >= $1
          AND recorded_at < $2
        ORDER BY recorded_at ASC
      `,
      [startUtc.toISOString(), endUtc.toISOString()],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message:
          `Tidak ada data untuk bulan ${archiveMonth}`,
        archiveMonth,
        rowCount: 0,
        deletedRowCount: 0,
        deleteAfterExport,
      })
    }

    const readings = mapDatabaseReadings(result.rows)

    if (readings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Data ditemukan, tetapi tidak ada nilai valid untuk diekspor.",
          archiveMonth,
          rowCount: result.rows.length,
          readingCount: 0,
          deletedRowCount: 0,
        },
        {
          status: 422,
        },
      )
    }

    const fileBuffer = await createMonthlyExcel({
      archiveMonth,
      readings,
    })

    const fileName =
      `laporan-monitoring-${archiveMonth}.xlsx`

    const uploadResult =
      await uploadExcelToGoogleDrive({
        fileName,
        fileBuffer,
      })

    let deletedRowCount = 0

    if (deleteAfterExport) {
      if (!uploadResult.id) {
        throw new Error(
          "File Google Drive tidak memiliki ID. " +
            "Penghapusan data dibatalkan.",
        )
      }

      deletedRowCount =
        await deleteExportedReadings({
          startUtc,
          endUtc,
          expectedRowCount: result.rows.length,
        })
    }

    return NextResponse.json({
      success: true,
      message: deleteAfterExport
        ? (
            `Laporan ${archiveMonth} berhasil diunggah ` +
            `dan ${deletedRowCount} data lama berhasil dihapus.`
          )
        : (
            `Laporan ${archiveMonth} berhasil diunggah. ` +
            "Penghapusan data masih dinonaktifkan."
          ),
      archiveMonth,
      period: {
        startUtc: startUtc.toISOString(),
        endUtc: endUtc.toISOString(),
      },
      rowCount: result.rows.length,
      readingCount: readings.length,
      deleteAfterExport,
      deletedRowCount,
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
      {
        status: 500,
      },
    )
  }
}