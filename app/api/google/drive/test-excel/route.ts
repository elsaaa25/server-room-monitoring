import {
  createMonthlyExcel,
  type MonthlySensorReading,
} from "@/lib/monthly-export"
import {
  uploadExcelToGoogleDrive,
} from "@/lib/google-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getCurrentMonthWib() {
  const parts =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date())

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  )

  return `${values.year}-${values.month}`
}

export async function GET() {
  // Route pengujian tidak boleh digunakan
  // setelah aplikasi masuk production.
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      {
        success: false,
        error:
          "Route pengujian dinonaktifkan pada production",
      },
      {
        status: 404,
      },
    )
  }

  try {
    const archiveMonth =
      getCurrentMonthWib()

    const now = new Date()
    const fiveMinutesAgo = new Date(
      now.getTime() - 5 * 60 * 1000,
    )

    const readings: MonthlySensorReading[] =
      [
        {
          id: 1,
          sensorId: "TEMP-L4",
          sensorName: "Suhu Lantai 4",
          metric: "Suhu",
          value: 23.6,
          unit: "°C",
          recordedAt: fiveMinutesAgo,
        },
        {
          id: 2,
          sensorId: "TEMP-L5",
          sensorName: "Suhu Lantai 5",
          metric: "Suhu",
          value: 24.1,
          unit: "°C",
          recordedAt: fiveMinutesAgo,
        },
        {
          id: 3,
          sensorId: "VOLT-01",
          sensorName: "Tegangan Server",
          metric: "Tegangan",
          value: 220.4,
          unit: "V",
          recordedAt: fiveMinutesAgo,
        },
        {
          id: 4,
          sensorId: "CURRENT-01",
          sensorName: "Arus Server",
          metric: "Arus",
          value: 1.82,
          unit: "A",
          recordedAt: fiveMinutesAgo,
        },
        {
          id: 5,
          sensorId: "TEMP-L4",
          sensorName: "Suhu Lantai 4",
          metric: "Suhu",
          value: 23.8,
          unit: "°C",
          recordedAt: now,
        },
        {
          id: 6,
          sensorId: "TEMP-L5",
          sensorName: "Suhu Lantai 5",
          metric: "Suhu",
          value: 24.3,
          unit: "°C",
          recordedAt: now,
        },
        {
          id: 7,
          sensorId: "VOLT-01",
          sensorName: "Tegangan Server",
          metric: "Tegangan",
          value: 221.1,
          unit: "V",
          recordedAt: now,
        },
        {
          id: 8,
          sensorId: "CURRENT-01",
          sensorName: "Arus Server",
          metric: "Arus",
          value: 1.9,
          unit: "A",
          recordedAt: now,
        },
      ]

    const fileBuffer =
      await createMonthlyExcel({
        archiveMonth,
        readings,
      })

    const fileName =
      `tes-arsip-monitoring-${archiveMonth}-${Date.now()}.xlsx`

    const uploaded =
      await uploadExcelToGoogleDrive({
        fileName,
        fileBuffer,
      })

    return Response.json({
      success: true,
      message:
        "Excel pengujian berhasil dibuat dan diunggah",
      totalRows: readings.length,
      file: uploaded,
    })
  } catch (error) {
    console.error(
      "Tes Excel bulanan gagal:",
      error,
    )

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal membuat Excel pengujian",
      },
      {
        status: 500,
      },
    )
  }
}