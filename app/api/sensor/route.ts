import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

export const runtime = "nodejs"

const readingSchema = z.object({
  sensorId: z.literal("TEMP-L4"),
  temperature: z.number().finite().min(-40).max(100),

  // Karena tampilan tegangan menggunakan nilai sekitar 220 V,
  // batas 10 V diubah menjadi 300 V.
  voltage: z.number().finite().min(0).max(300).optional(),
})

type AlertLevel = "Waspada" | "Bahaya"

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
  level: AlertLevel,
  temperature: number,
  warningTemperature: number,
  dangerTemperature: number,
) {
  if (level === "Bahaya") {
    return {
      title: "Suhu ruang server berada pada level bahaya",
      detail:
        `Suhu ${temperature.toFixed(2)}°C telah mencapai atau melewati ` +
        `batas bahaya ${dangerTemperature.toFixed(2)}°C. ` +
        "Segera periksa AC dan kondisi ruang server.",
    }
  }

  return {
    title: "Suhu ruang server berada pada level waspada",
    detail:
      `Suhu ${temperature.toFixed(2)}°C telah melewati ` +
      `batas waspada ${warningTemperature.toFixed(2)}°C. ` +
      "Periksa pendingin dan sirkulasi udara ruang server.",
  }
}

export async function POST(request: Request) {
  const client = await db.connect()

  try {
    const sensorApiKey = process.env.SENSOR_API_KEY

    if (!sensorApiKey) {
      console.error("SENSOR_API_KEY belum tersedia.")

      return NextResponse.json(
        {
          success: false,
          error: "Konfigurasi server belum lengkap",
        },
        { status: 500 },
      )
    }

    const authorization =
      request.headers.get("authorization")

    if (authorization !== `Bearer ${sensorApiKey}`) {
      return NextResponse.json(
        {
          success: false,
          error: "Perangkat tidak diizinkan",
        },
        { status: 401 },
      )
    }

    const body: unknown = await request.json()
    const parsed = readingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
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

    await client.query("BEGIN")

    // Mencegah dua pengiriman bersamaan membuat
    // peringatan ganda.
    await client.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtext($1)
        )
      `,
      [sensorId],
    )

    const readingResult = await client.query(
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
          temperature::float8 AS temperature,
          voltage::float8 AS voltage,
          recorded_at AS "recordedAt"
      `,
      [
        sensorId,
        temperature,
        voltage ?? null,
      ],
    )

    // Ambil batas suhu dari halaman Pengaturan.
    const settingsResult = await client.query(
      `
        SELECT
          warning_temperature::float8
            AS "warningTemperature",
          danger_temperature::float8
            AS "dangerTemperature"
        FROM monitoring_settings
        WHERE id = 'global'
        LIMIT 1
      `,
    )

    const warningTemperature = Number(
      settingsResult.rows[0]
        ?.warningTemperature ?? 27,
    )

    const dangerTemperature = Number(
      settingsResult.rows[0]
        ?.dangerTemperature ?? 30,
    )

    const alertLevel = getAlertLevel(
      temperature,
      warningTemperature,
      dangerTemperature,
    )

    if (alertLevel === null) {
      // Suhu kembali normal.
      // Siklus peringatan sebelumnya ditutup.
      await client.query(
        `
          UPDATE temperature_alerts
          SET
            status = 'Ditangani',
            resolved_at =
              COALESCE(resolved_at, NOW())
          WHERE sensor_id = $1
            AND resolved_at IS NULL
        `,
        [sensorId],
      )
    } else {
      const latestAlertResult =
        await client.query<{
          level: AlertLevel
          resolvedAt: Date | null
        }>(
          `
            SELECT
              level,
              resolved_at AS "resolvedAt"
            FROM temperature_alerts
            WHERE sensor_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          `,
          [sensorId],
        )

      const latestAlert =
        latestAlertResult.rows[0]

      const isNewTemperatureCycle =
        !latestAlert ||
        latestAlert.resolvedAt !== null

      const isEscalation =
        latestAlert?.resolvedAt === null &&
        latestAlert.level === "Waspada" &&
        alertLevel === "Bahaya"

      if (
        isNewTemperatureCycle ||
        isEscalation
      ) {
        if (isEscalation) {
          // Saat Waspada berubah menjadi Bahaya,
          // peringatan Waspada tidak lagi aktif.
          await client.query(
            `
              UPDATE temperature_alerts
              SET status = 'Ditangani'
              WHERE sensor_id = $1
                AND status = 'Aktif'
                AND resolved_at IS NULL
            `,
            [sensorId],
          )
        }

        const content = getAlertContent(
          alertLevel,
          temperature,
          warningTemperature,
          dangerTemperature,
        )

        await client.query(
          `
            INSERT INTO temperature_alerts (
              reading_id,
              sensor_id,
              level,
              status,
              temperature,
              title,
              detail,
              created_at
            )
            VALUES (
              $1,
              $2,
              $3,
              'Aktif',
              $4,
              $5,
              $6,
              NOW()
            )
          `,
          [
            readingResult.rows[0].id,
            sensorId,
            alertLevel,
            temperature,
            content.title,
            content.detail,
          ],
        )
      }
    }

    await client.query("COMMIT")

    return NextResponse.json(
      {
        success: true,
        message:
          "Data suhu lantai 4 berhasil disimpan.",
        data: readingResult.rows[0],
      },
      { status: 201 },
    )
  } catch (error) {
    await client.query("ROLLBACK")

    console.error(
      "Gagal menyimpan data sensor:",
      error,
    )

    return NextResponse.json(
      {
        success: false,
        error: "Gagal menyimpan data sensor",
      },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}