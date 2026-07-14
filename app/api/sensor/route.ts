import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    // 1. Validasi API Key Keamanan
    const apiKey = request.headers.get("x-api-key")
    const serverApiKey = process.env.SENSOR_API_KEY

    if (!serverApiKey) {
      console.error("SENSOR_API_KEY tidak dikonfigurasi di environment variable server.")
      return NextResponse.json(
        { error: "Konfigurasi server tidak lengkap" },
        { status: 500 }
      )
    }

    if (apiKey !== serverApiKey) {
      return NextResponse.json(
        { error: "API Key tidak valid atau tidak disertakan" },
        { status: 401 }
      )
    }

    // 2. Parse Body Data Sensor
    const body = await request.json()
    const { sensorId, temperature, voltage } = body

    if (!sensorId || temperature === undefined || temperature === null) {
      return NextResponse.json(
        { error: "Parameter 'sensorId' dan 'temperature' wajib diisi" },
        { status: 400 }
      )
    }

    // 3. Simpan ke Database
    // Simpan ke tabel sensor_readings
    await db.query(
      `INSERT INTO sensor_readings (sensor_id, temperature, voltage)
       VALUES ($1, $2, $3)`,
      [sensorId, temperature, voltage !== undefined ? voltage : null]
    )

    return NextResponse.json(
      { success: true, message: "Data sensor berhasil disimpan" },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Gagal menyimpan data sensor:", error)
    return NextResponse.json(
      { error: "Gagal memproses data", details: error.message },
      { status: 500 }
    )
  }
}
