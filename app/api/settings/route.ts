import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/auth"

// GET: Mengambil pengaturan monitoring dari database
export async function GET() {
  try {
    const result = await db.query(
      `SELECT 
        warning_temperature as "warningTemperature",
        danger_temperature as "dangerTemperature",
        refresh_interval as "refreshInterval",
        offline_timeout as "offlineTimeout",
        sensor_name as "sensorName",
        sensor_id as "sensorId",
        browser_notification as "browserNotification",
        sound_alert as "soundAlert"
       FROM monitoring_settings WHERE id = 'global' LIMIT 1`
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Pengaturan tidak ditemukan" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error: any) {
    console.error("Gagal mengambil pengaturan dari database:", error)
    return NextResponse.json({ error: "Gagal mengambil data", details: error.message }, { status: 500 })
  }
}

// POST: Menyimpan pengaturan baru ke database (Hanya boleh diakses oleh ADMIN)
export async function POST(request: Request) {
  try {
    // 1. Validasi Autentikasi & Role Admin
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Hanya Administrator yang dapat mengubah pengaturan" }, { status: 403 })
    }

    // 2. Parse Body Data Pengaturan
    const body = await request.json()
    const { 
      warningTemperature, 
      dangerTemperature, 
      refreshInterval, 
      offlineTimeout, 
      sensorName, 
      sensorId, 
      browserNotification, 
      soundAlert 
    } = body

    // Validasi data input
    if (warningTemperature === undefined || dangerTemperature === undefined) {
      return NextResponse.json({ error: "Parameter suhu wajib diisi" }, { status: 400 })
    }

    if (warningTemperature >= dangerTemperature) {
      return NextResponse.json({ error: "Batas suhu bahaya harus lebih tinggi dari batas waspada" }, { status: 400 })
    }

    // 3. Update ke Database
    await db.query(
      `INSERT INTO monitoring_settings (
        id, warning_temperature, danger_temperature, refresh_interval, 
        offline_timeout, sensor_name, sensor_id, browser_notification, sound_alert, updated_at
      )
      VALUES (
        'global', $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        warning_temperature = EXCLUDED.warning_temperature,
        danger_temperature = EXCLUDED.danger_temperature,
        refresh_interval = EXCLUDED.refresh_interval,
        offline_timeout = EXCLUDED.offline_timeout,
        sensor_name = EXCLUDED.sensor_name,
        sensor_id = EXCLUDED.sensor_id,
        browser_notification = EXCLUDED.browser_notification,
        sound_alert = EXCLUDED.sound_alert,
        updated_at = NOW()`,
      [
        warningTemperature,
        dangerTemperature,
        refreshInterval || 4,
        offlineTimeout || 30,
        sensorName || "Sensor Ruang Server",
        sensorId || "esp32-01",
        browserNotification !== undefined ? browserNotification : true,
        soundAlert !== undefined ? soundAlert : false
      ]
    )

    return NextResponse.json({
      success: true,
      message: "Pengaturan berhasil disimpan ke database"
    })
  } catch (error: any) {
    console.error("Gagal menyimpan pengaturan ke database:", error)
    return NextResponse.json({ error: "Gagal menyimpan data", details: error.message }, { status: 500 })
  }
}
