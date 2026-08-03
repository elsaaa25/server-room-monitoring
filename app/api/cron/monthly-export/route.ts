import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { uploadExcelToGoogleDrive } from "@/lib/google-drive"
import {
  createMonthlyExcel,
  type MonthlySensorReading,
} from "@/lib/monthly-export"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

const DEPLOYMENT_VERSION = "monthly-cleanup-v3"
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

type DatabaseReading = {
  id: number
  sensor_id: string
  temperature: string | null
  voltage: string | null
  current: string | null
  recorded_at: Date
}

type MonthRange = {
  startUtc: Date
  endUtc: Date
}

/**
 * Mengambil bulan yang akan diekspor.
 *
 * Jika URL mempunyai:
 * ?month=2026-07
 *
 * maka bulan tersebut digunakan.
 *
 * Jika tidak ada parameter month, sistem otomatis
 * menggunakan bulan sebelumnya berdasarkan WIB.
 */
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

  // Mengubah waktu sekarang menjadi acuan WIB.
  const wibNow = new Date(
    now.getTime() + WIB_OFFSET_MS,
  )

  const currentYear = wibNow.getUTCFullYear()
  const currentMonthIndex = wibNow.getUTCMonth()

  /*
   * getUTCMonth():
   * Januari = 0
   * Februari = 1
   * ...
   * Desember = 11
   */
  const previousMonth =
    currentMonthIndex === 0
      ? 12
      : currentMonthIndex

  const previousYear =
    currentMonthIndex === 0
      ? currentYear - 1
      : currentYear

  return (
    `${previousYear}-` +
    `${String(previousMonth).padStart(2, "0")}`
  )
}

/**
 * Membuat rentang bulan berdasarkan WIB,
 * lalu dikonversi menjadi UTC untuk query database.
 *
 * Contoh bulan 2026-07:
 *
 * startUtc:
 * 2026-06-30T17:00:00.000Z
 * = 1 Juli 2026 pukul 00.00 WIB
 *
 * endUtc:
 * 2026-07-31T17:00:00.000Z
 * = 1 Agustus 2026 pukul 00.00 WIB
 */
function getMonthRangeUtc(
  archiveMonth: string,
): MonthRange {
  const [yearText, monthText] =
    archiveMonth.split("-")

  const year = Number(yearText)
  const month = Number(monthText)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      "Format bulan arsip tidak valid.",
    )
  }

  const startUtc = new Date(
    Date.UTC(
      year,
      month - 1,
      1,
      0,
      0,
      0,
    ) - WIB_OFFSET_MS,
  )

  const endUtc = new Date(
    Date.UTC(
      year,
      month,
      1,
      0,
      0,
      0,
    ) - WIB_OFFSET_MS,
  )

  return {
    startUtc,
    endUtc,
  }
}

/**
 * Mengubah baris sensor_readings menjadi data
 * yang dibutuhkan pembuat file Excel.
 *
 * Satu baris database dapat menghasilkan lebih
 * dari satu reading Excel.
 *
 * Contoh:
 * - suhu
 * - tegangan
 *
 * Oleh karena itu readingCount dapat lebih besar
 * daripada rowCount.
 */
function mapDatabaseReadings(
  rows: DatabaseReading[],
): MonthlySensorReading[] {
  const readings: MonthlySensorReading[] = []

  for (const row of rows) {
    const sensorId =
      row.sensor_id
        .trim()
        .toUpperCase()

    if (row.temperature !== null) {
      const temperature =
        Number(row.temperature)

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
      const voltage =
        Number(row.voltage)

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
      const current =
        Number(row.current)

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

/**
 * Menghapus data yang sudah berhasil diekspor.
 *
 * Penghapusan menggunakan transaksi:
 *
 * BEGIN
 * DELETE
 * COMMIT
 *
 * Jika jumlah data yang terhapus tidak sama
 * dengan jumlah baris yang diekspor, transaksi
 * dibatalkan menggunakan ROLLBACK.
 */
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

    const deleteResult =
      await client.query(
        `
          DELETE FROM sensor_readings
          WHERE recorded_at >= $1
            AND recorded_at < $2
        `,
        [
          startUtc.toISOString(),
          endUtc.toISOString(),
        ],
      )

    const deletedRowCount =
      deleteResult.rowCount ?? 0

    /*
     * Pengamanan agar jumlah data yang dihapus
     * sama dengan jumlah baris sumber export.
     */
    if (
      deletedRowCount !==
      expectedRowCount
    ) {
      throw new Error(
        "Jumlah data yang terhapus berbeda " +
          "dengan jumlah data yang diekspor. " +
          `Export: ${expectedRowCount}, ` +
          `hapus: ${deletedRowCount}. ` +
          "Transaksi penghapusan dibatalkan.",
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

export async function GET(
  request: Request,
) {
  const cronSecret =
    process.env.CRON_SECRET?.trim()

  const authHeader =
    request.headers.get(
      "authorization",
    )

  /*
   * Endpoint hanya dapat dijalankan menggunakan:
   *
   * Authorization: Bearer CRON_SECRET
   */
  if (
    !cronSecret ||
    authHeader !==
      `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        success: false,
        deploymentVersion:
          DEPLOYMENT_VERSION,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    )
  }

  try {
    const archiveMonth =
      getArchiveMonth(request.url)

    const {
      startUtc,
      endUtc,
    } = getMonthRangeUtc(
      archiveMonth,
    )

    /*
     * Nilai environment dibuat lebih tahan
     * terhadap spasi dan perbedaan huruf.
     *
     * Nilai berikut dianggap aktif:
     * true
     * TRUE
     * True
     * true dengan spasi
     */
    const deleteAfterExport =
      (
        process.env
          .DELETE_AFTER_MONTHLY_EXPORT ??
        ""
      )
        .trim()
        .toLowerCase() === "true"

    console.log(
      "[monthly-export] Version:",
      DEPLOYMENT_VERSION,
    )

    console.log(
      "[monthly-export] Archive month:",
      archiveMonth,
    )

    console.log(
      "[monthly-export] Period:",
      startUtc.toISOString(),
      "sampai",
      endUtc.toISOString(),
    )

    console.log(
      "[monthly-export] Delete enabled:",
      deleteAfterExport,
    )

    /*
     * Mengambil semua data bulan yang dipilih.
     *
     * Batas akhir menggunakan "< endUtc",
     * sehingga data tanggal 1 bulan baru tidak
     * ikut diekspor atau dihapus.
     */
    const result =
      await db.query<DatabaseReading>(
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
        [
          startUtc.toISOString(),
          endUtc.toISOString(),
        ],
      )

    const rowCount =
      result.rows.length

    console.log(
      "[monthly-export] Database rows:",
      rowCount,
    )

    if (rowCount === 0) {
      return NextResponse.json({
        success: false,
        deploymentVersion:
          DEPLOYMENT_VERSION,
        message:
          `Tidak ada data untuk bulan ${archiveMonth}.`,
        archiveMonth,
        period: {
          startUtc:
            startUtc.toISOString(),
          endUtc:
            endUtc.toISOString(),
        },
        rowCount: 0,
        readingCount: 0,
        deleteAfterExport,
        deletedRowCount: 0,
      })
    }

    const readings =
      mapDatabaseReadings(
        result.rows,
      )

    console.log(
      "[monthly-export] Excel readings:",
      readings.length,
    )

    if (readings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          deploymentVersion:
            DEPLOYMENT_VERSION,
          error:
            "Data ditemukan, tetapi tidak ada nilai valid untuk diekspor.",
          archiveMonth,
          period: {
            startUtc:
              startUtc.toISOString(),
            endUtc:
              endUtc.toISOString(),
          },
          rowCount,
          readingCount: 0,
          deleteAfterExport,
          deletedRowCount: 0,
        },
        {
          status: 422,
        },
      )
    }

    /*
     * LANGKAH 1:
     * Membuat file Excel.
     */
    const fileBuffer =
      await createMonthlyExcel({
        archiveMonth,
        readings,
      })

    const fileName =
      `laporan-monitoring-${archiveMonth}.xlsx`

    /*
     * LANGKAH 2:
     * Mengunggah file Excel ke Google Drive.
     *
     * Jika upload gagal, fungsi akan masuk ke catch.
     * Proses DELETE tidak pernah dijalankan.
     */
    const uploadResult =
      await uploadExcelToGoogleDrive({
        fileName,
        fileBuffer,
      })

    /*
     * Google Drive harus mengembalikan file ID.
     * Tanpa ID, file belum dianggap berhasil tersimpan.
     */
    if (!uploadResult.id) {
      throw new Error(
        "Google Drive tidak mengembalikan file ID. " +
          "Penghapusan data dibatalkan.",
      )
    }

    console.log(
      "[monthly-export] Google Drive file ID:",
      uploadResult.id,
    )

    /*
     * LANGKAH 3:
     * Menghapus data hanya jika environment
     * DELETE_AFTER_MONTHLY_EXPORT aktif.
     */
    let deletedRowCount = 0

    if (deleteAfterExport) {
      console.log(
        "[monthly-export] Memulai penghapusan data.",
      )

      deletedRowCount =
        await deleteExportedReadings({
          startUtc,
          endUtc,
          expectedRowCount:
            rowCount,
        })

      console.log(
        "[monthly-export] Data terhapus:",
        deletedRowCount,
      )
    } else {
      console.log(
        "[monthly-export] Penghapusan dinonaktifkan.",
      )
    }

    return NextResponse.json({
      success: true,
      deploymentVersion:
        DEPLOYMENT_VERSION,
      message: deleteAfterExport
        ? (
            `Laporan ${archiveMonth} berhasil ` +
            `diunggah ke Google Drive dan ` +
            `${deletedRowCount} data lama ` +
            "berhasil dihapus."
          )
        : (
            `Laporan ${archiveMonth} berhasil ` +
            "diunggah ke Google Drive. " +
            "Penghapusan data masih dinonaktifkan."
          ),
      archiveMonth,
      period: {
        startUtc:
          startUtc.toISOString(),
        endUtc:
          endUtc.toISOString(),
      },
      rowCount,
      readingCount:
        readings.length,
      deleteAfterExport,
      deletedRowCount,
      file: {
        id: uploadResult.id,
        name: uploadResult.name,
        webViewLink:
          uploadResult.webViewLink,
      },
    })
  } catch (error) {
    console.error(
      "[monthly-export] Gagal:",
      error,
    )

    return NextResponse.json(
      {
        success: false,
        deploymentVersion:
          DEPLOYMENT_VERSION,
        error:
          error instanceof Error
            ? error.message
            : (
                "Terjadi kesalahan " +
                "yang tidak diketahui."
              ),
      },
      {
        status: 500,
      },
    )
  }
}