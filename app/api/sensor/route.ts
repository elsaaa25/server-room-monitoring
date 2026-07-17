import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

export const runtime = "nodejs"

const readingSchema = z.object({
  sensorId: z.literal("TEMP-L4"),
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
})

type AlertLevel = "Waspada" | "Bahaya"
type AlertAction =
  | "normal"
  | "created"
  | "escalated"
  | "unchanged"

type SavedReading = {
  id: number
  sensorId: string
  temperature: number
  voltage: number | null
  recordedAt: Date
}

type OpenAlert = {
  id: number
  level: AlertLevel
  status: "Aktif" | "Ditangani"
  createdAt: Date
  resolvedAt: Date | null
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
  level: AlertLevel,
  temperature: number,
  warningTemperature: number,
  dangerTemperature: number,
) {
  if (level === "Bahaya") {
    return {
      title:
        "Suhu ruang server berada pada level bahaya",
      detail:
        `Suhu ${temperature.toFixed(2)}°C telah mencapai ` +
        `atau melewati batas bahaya ` +
        `${dangerTemperature.toFixed(2)}°C. ` +
        "Segera periksa AC dan kondisi ruang server.",
    }
  }

  return {
    title:
      "Suhu ruang server berada pada level waspada",
    detail:
      `Suhu ${temperature.toFixed(2)}°C telah melewati ` +
      `batas waspada ` +
      `${warningTemperature.toFixed(2)}°C. ` +
      "Periksa pendingin dan sirkulasi udara ruang server.",
  }
}

export async function POST(request: Request) {
  try {
    const sensorApiKey =
      process.env.SENSOR_API_KEY

    if (!sensorApiKey) {
      console.error(
        "SENSOR_API_KEY belum tersedia.",
      )

      return NextResponse.json(
        {
          success: false,
          error:
            "Konfigurasi server belum lengkap",
        },
        { status: 500 },
      )
    }

    const authorization =
      request.headers.get("authorization")

    if (
      authorization !==
      `Bearer ${sensorApiKey}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Perangkat tidak diizinkan",
        },
        { status: 401 },
      )
    }

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Format JSON tidak valid",
        },
        { status: 400 },
      )
    }

    const parsed =
      readingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Data sensor tidak valid",
          details:
            parsed.error.flatten(),
        },
        { status: 400 },
      )
    }

    const {
      sensorId,
      temperature,
      voltage,
    } = parsed.data

    const client = await db.connect()
    let transactionStarted = false

    try {
      await client.query("BEGIN")
      transactionStarted = true

      /*
       * Mencegah dua request ESP32 yang datang
       * bersamaan membuat peringatan ganda.
       */
      await client.query(
        `
          SELECT pg_advisory_xact_lock(
            hashtext($1)
          )
        `,
        [sensorId],
      )

      const readingResult =
        await client.query<SavedReading>(
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
              temperature::float8
                AS temperature,
              voltage::float8
                AS voltage,
              recorded_at AS "recordedAt"
          `,
          [
            sensorId,
            temperature,
            voltage ?? null,
          ],
        )

      const savedReading =
        readingResult.rows[0]

      /*
       * Mengambil batas suhu terbaru dari
       * halaman Pengaturan.
       */
      const settingsResult =
        await client.query<{
          warningTemperature: number
          dangerTemperature: number
        }>(
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

      let alertAction: AlertAction =
        "unchanged"

      if (alertLevel === null) {
        /*
         * SUHU NORMAL
         *
         * Semua peringatan dalam siklus sebelumnya
         * ditutup, termasuk peringatan yang sudah
         * ditekan tombol Tangani.
         */
        await client.query(
          `
            UPDATE temperature_alerts
            SET
              status = 'Ditangani',
              resolved_at = COALESCE(
                resolved_at,
                $2
              )
            WHERE sensor_id = $1
              AND resolved_at IS NULL
          `,
          [
            sensorId,
            savedReading.recordedAt,
          ],
        )

        alertAction = "normal"
      } else {
        /*
         * Mencari kapan siklus peringatan yang
         * masih terbuka dimulai.
         */
        const openCycleResult =
          await client.query<{
            cycleStartedAt: Date | null
          }>(
            `
              SELECT
                MIN(created_at)
                  AS "cycleStartedAt"
              FROM temperature_alerts
              WHERE sensor_id = $1
                AND resolved_at IS NULL
            `,
            [sensorId],
          )

        const cycleStartedAt =
          openCycleResult.rows[0]
            ?.cycleStartedAt ?? null

        /*
         * PERBAIKAN DATA LAMA
         *
         * Apabila resolved_at masih NULL, tetapi
         * sebenarnya pernah ada pembacaan Normal
         * setelah peringatan dibuat, tutup siklus
         * lama secara otomatis.
         */
        if (cycleStartedAt) {
          const normalReadingResult =
            await client.query<{
              normalAt: Date | null
            }>(
              `
                SELECT
                  MIN(recorded_at)
                    AS "normalAt"
                FROM sensor_readings
                WHERE sensor_id = $1
                  AND recorded_at > $2
                  AND recorded_at < $3
                  AND temperature <= $4
              `,
              [
                sensorId,
                cycleStartedAt,
                savedReading.recordedAt,
                warningTemperature,
              ],
            )

          const normalAt =
            normalReadingResult.rows[0]
              ?.normalAt ?? null

          if (normalAt) {
            await client.query(
              `
                UPDATE temperature_alerts
                SET
                  status = 'Ditangani',
                  resolved_at = COALESCE(
                    resolved_at,
                    $2
                  )
                WHERE sensor_id = $1
                  AND resolved_at IS NULL
              `,
              [sensorId, normalAt],
            )
          }
        }

        /*
         * Setelah kemungkinan siklus lama ditutup,
         * cari peringatan yang masih belum selesai.
         */
        const latestAlertResult =
          await client.query<OpenAlert>(
            `
              SELECT
                id,
                level,
                status,
                created_at AS "createdAt",
                resolved_at AS "resolvedAt"
              FROM temperature_alerts
              WHERE sensor_id = $1
                AND resolved_at IS NULL
              ORDER BY
                created_at DESC,
                id DESC
              LIMIT 1
            `,
            [sensorId],
          )

        const latestAlert =
          latestAlertResult.rows[0]

        /*
         * Tidak ada siklus terbuka:
         * buat peringatan baru.
         */
        const isNewTemperatureCycle =
          !latestAlert

        /*
         * Waspada naik menjadi Bahaya:
         * buat peringatan Bahaya baru.
         */
        const isEscalation =
          latestAlert?.level ===
            "Waspada" &&
          alertLevel === "Bahaya"

        if (
          isNewTemperatureCycle ||
          isEscalation
        ) {
          if (isEscalation) {
            /*
             * Peringatan Waspada tidak lagi aktif,
             * tetapi resolved_at tetap NULL sampai
             * suhu benar-benar Normal.
             */
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

          const content =
            getAlertContent(
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
                $7
              )
            `,
            [
              savedReading.id,
              sensorId,
              alertLevel,
              temperature,
              content.title,
              content.detail,
              savedReading.recordedAt,
            ],
          )

          alertAction = isEscalation
            ? "escalated"
            : "created"
        }
      }

      await client.query("COMMIT")
      transactionStarted = false

      return NextResponse.json(
        {
          success: true,
          message:
            "Data suhu lantai 4 berhasil disimpan.",
          data: savedReading,
          alert: {
            level:
              alertLevel ?? "Normal",
            action: alertAction,
          },
        },
        { status: 201 },
      )
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK")
        } catch (rollbackError) {
          console.error(
            "Gagal melakukan rollback:",
            rollbackError,
          )
        }
      }

      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error(
      "Gagal menyimpan data sensor:",
      error,
    )

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal menyimpan data sensor",
      },
      { status: 500 },
    )
  }
}