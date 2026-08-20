import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

export const runtime = "nodejs"

const readingSchema = z.object({
  sensorId: z.enum([
    "TEMP-L4",
    "TEMP-L5",
  ]),

  temperature: z
    .number()
    .finite()
    .min(-40)
    .max(100),

  voltage: z
    .number()
    .finite()
    .min(0)
    .max(300)
    .optional(),

  current: z
    .number()
    .finite()
    .min(0)
    .max(999)
    .optional(),
})

type AlertLevel = "Waspada" | "Bahaya"
type AlertAction =
  | "normal"
  | "created"
  | "escalated"
  | "unchanged"

type VoltageAnomalyType = "Drop" | "Surge"

type SavedReading = {
  id: number
  sensorId: string
  temperature: number
  voltage: number | null
  current: number | null
  recordedAt: Date
}

type OpenAlert = {
  id: number
  level: AlertLevel
  status: "Aktif" | "Ditangani"
  createdAt: Date
  resolvedAt: Date | null
}

type OpenVoltageAlert = {
  id: number
  anomalyType: VoltageAnomalyType
  level: AlertLevel
  status: "Aktif" | "Ditangani"
  createdAt: Date
  resolvedAt: Date | null
}

function getSensorLocation(
  sensorId: string,
): string {
  if (sensorId === "TEMP-L4") {
    return "Lantai 4 (Ruang Server)"
  }

  if (sensorId === "TEMP-L5") {
    return "Lantai 5 (Ruang ATC)"
  }

  return sensorId
}

function getAlertLevel(
  temperature: number,
  warningTemperature: number,
  dangerTemperature: number,
): AlertLevel | null {
  if (temperature >= dangerTemperature) {
    return "Bahaya"
  }

  if (temperature > warningTemperature) {
    return "Waspada"
  }

  return null
}

function getAlertContent(
  sensorId: string,
  level: AlertLevel,
  temperature: number,
  warningTemperature: number,
  dangerTemperature: number,
) {
  const location =
    getSensorLocation(sensorId)

  if (level === "Bahaya") {
    return {
      title:
        `Suhu ${location} berada pada level bahaya`,
      detail:
        `Suhu ${temperature.toFixed(2)}°C ` +
        `telah mencapai atau melewati batas bahaya ` +
        `${dangerTemperature.toFixed(2)}°C. ` +
        `Segera periksa AC dan kondisi ruangan.`,
    }
  }

  return {
    title:
      `Suhu ${location} berada pada level waspada`,
    detail:
      `Suhu ${temperature.toFixed(2)}°C ` +
      `telah melewati batas waspada ` +
      `${warningTemperature.toFixed(2)}°C. ` +
      `Periksa pendingin dan sirkulasi udara.`,
  }
}

function getVoltageAnomalyType(
  voltage: number,
  voltageMin: number,
  voltageMax: number,
): VoltageAnomalyType | null {
  if (voltage < voltageMin) return "Drop"
  if (voltage > voltageMax) return "Surge"
  return null
}

function getVoltageAlertContent(
  sensorId: string,
  anomalyType: VoltageAnomalyType,
  voltage: number,
  voltageMin: number,
  voltageMax: number,
) {
  const location = getSensorLocation(sensorId)

  if (anomalyType === "Drop") {
    return {
      title: `Tegangan Drop di ${location}`,
      detail:
        `Tegangan terdeteksi ${voltage.toFixed(1)} V, ` +
        `di bawah batas minimum ${voltageMin.toFixed(1)} V. ` +
        `Periksa sumber listrik dan stabilizer.`,
    }
  }

  return {
    title: `Tegangan Surge di ${location}`,
    detail:
      `Tegangan terdeteksi ${voltage.toFixed(1)} V, ` +
      `melebihi batas maksimum ${voltageMax.toFixed(1)} V. ` +
      `Segera periksa UPS dan jalur listrik.`,
  }
}

export async function POST(request: Request) {
  try {
    const sensorApiKey = process.env.SENSOR_API_KEY

    if (!sensorApiKey) {
      console.error("SENSOR_API_KEY belum tersedia.")
      return NextResponse.json(
        { success: false, error: "Konfigurasi server belum lengkap" },
        { status: 500 }
      )
    }

    const authorization = request.headers.get("authorization")

    if (authorization !== `Bearer ${sensorApiKey}`) {
      return NextResponse.json(
        { success: false, error: "Perangkat tidak diizinkan" },
        { status: 401 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "JSON tidak valid" },
        { status: 400 }
      )
    }

    // 1. Validasi Input Data
    const result = readingSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Data tidak valid", details: result.error.format() },
        { status: 400 }
      )
    }

    const { sensorId, temperature, voltage, current } = result.data

    // 2. Simpan Data ke Database Supabase
    // Menggunakan Pool dari pg yang dikonfigurasi di lib/db
    const query = `
      INSERT INTO sensor_readings (sensor_id, temperature, voltage, current, recorded_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `
    const values = [sensorId, temperature, voltage ?? null, current ?? null]
    
    // Asumsi database Pool diimport dari '@/lib/db'
    const dbResult = await db.query(query, values)
    const savedReading = dbResult.rows[0]

    // 3. Kembalikan Response Sukses
    return NextResponse.json({
      success: true,
      data: savedReading
    })

  } catch (error) {
    console.error("Gagal menyimpan data sensor:", error)
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan data sensor" },
      { status: 500 }
    )
  }
}