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
      current,
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
              current,
              recorded_at
            )
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING
              id,
              sensor_id AS "sensorId",
              temperature::float8
                AS temperature,
              voltage::float8
                AS voltage,
              current::float8
                AS current,
              recorded_at AS "recordedAt"
          `,
          [
            sensorId,
            temperature,
            voltage ?? null,
            current ?? null,
          ],
        )

      const savedReading =
        readingResult.rows[0]

      /*
       * Mengambil batas suhu dan tegangan terbaru
       * dari halaman Pengaturan.
       */
      const settingsResult =
        await client.query<{
          warningTemperature: number
          dangerTemperature: number
          warningTemperatureL5: number
          dangerTemperatureL5: number
          voltageMin: number
          voltageMax: number
        }>(
          `
            SELECT
              warning_temperature::float8
                AS "warningTemperature",
              danger_temperature::float8
                AS "dangerTemperature",
              warning_temperature_l5::float8
                AS "warningTemperatureL5",
              danger_temperature_l5::float8
                AS "dangerTemperatureL5",
              COALESCE(voltage_min::float8, 200)
                AS "voltageMin",
              COALESCE(voltage_max::float8, 240)
                AS "voltageMax"
            FROM monitoring_settings
            WHERE id = 'global'
            LIMIT 1
          `,
        )

      // Pilih batas alarm sesuai lantai sensor
      const isL5 = sensorId === "TEMP-L5"

      const warningTemperature = Number(
        isL5
          ? (settingsResult.rows[0]?.warningTemperatureL5 ?? 27)
          : (settingsResult.rows[0]?.warningTemperature ?? 27),
      )

      const dangerTemperature = Number(
        isL5
          ? (settingsResult.rows[0]?.dangerTemperatureL5 ?? 30)
          : (settingsResult.rows[0]?.dangerTemperature ?? 30),
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

          const content = getAlertContent(
  sensorId,
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

      /*
       * ─────────────────────────────────────────
       * SISTEM PERINGATAN TEGANGAN
       * ─────────────────────────────────────────
       * Hanya berjalan jika sensor mengirim data
       * tegangan (voltage !== null).
       */
      const voltageMin = Number(
        settingsResult.rows[0]?.voltageMin ?? 200,
      )
      const voltageMax = Number(
        settingsResult.rows[0]?.voltageMax ?? 240,
      )

      let voltageAlertAction: AlertAction = "unchanged"

      if (savedReading.voltage !== null) {
        const voltageValue = savedReading.voltage
        const anomalyType = getVoltageAnomalyType(
          voltageValue,
          voltageMin,
          voltageMax,
        )

        if (anomalyType === null) {
          /*
           * TEGANGAN NORMAL
           * Tutup semua voltage_alerts yang masih terbuka.
           */
          await client.query(
            `
              UPDATE voltage_alerts
              SET
                status = 'Ditangani',
                resolved_at = COALESCE(
                  resolved_at,
                  $2
                )
              WHERE sensor_id = $1
                AND resolved_at IS NULL
            `,
            [sensorId, savedReading.recordedAt],
          )

          voltageAlertAction = "normal"
        } else {
          /*
           * Cari voltage alert yang masih aktif (terbuka).
           */
          const openVoltageResult =
            await client.query<OpenVoltageAlert>(
              `
                SELECT
                  id,
                  anomaly_type AS "anomalyType",
                  level,
                  status,
                  created_at AS "createdAt",
                  resolved_at AS "resolvedAt"
                FROM voltage_alerts
                WHERE sensor_id = $1
                  AND resolved_at IS NULL
                ORDER BY
                  created_at DESC,
                  id DESC
                LIMIT 1
              `,
              [sensorId],
            )

          const latestVoltageAlert =
            openVoltageResult.rows[0]

          /*
           * Tidak ada alert terbuka → buat baru.
           * Jenis anomaly berubah (misal Drop → Surge) → buat baru.
           */
          const isNewVoltageCycle = !latestVoltageAlert
          const isTypeChanged =
            latestVoltageAlert?.anomalyType !== anomalyType

          if (isNewVoltageCycle || isTypeChanged) {
            if (isTypeChanged && latestVoltageAlert) {
              /* Tutup alert lama yang jenisnya berbeda */
              await client.query(
                `
                  UPDATE voltage_alerts
                  SET status = 'Ditangani'
                  WHERE sensor_id = $1
                    AND status = 'Aktif'
                    AND resolved_at IS NULL
                `,
                [sensorId],
              )
            }

            const voltageContent = getVoltageAlertContent(
              sensorId,
              anomalyType,
              voltageValue,
              voltageMin,
              voltageMax,
            )

            await client.query(
              `
                INSERT INTO voltage_alerts (
                  reading_id,
                  sensor_id,
                  anomaly_type,
                  level,
                  status,
                  voltage,
                  title,
                  detail,
                  created_at
                )
                VALUES (
                  $1, $2, $3, 'Bahaya',
                  'Aktif', $4, $5, $6, $7
                )
              `,
              [
                savedReading.id,
                sensorId,
                anomalyType,
                voltageValue,
                voltageContent.title,
                voltageContent.detail,
                savedReading.recordedAt,
              ],
            )

            voltageAlertAction = "created"
          }
        }
      }

      await client.query("COMMIT")
      transactionStarted = false


      return NextResponse.json(
        {
          success: true,
          message:
  `Data ${sensorId} berhasil disimpan.`,
          data: savedReading,
          alert: {
            level:
              alertLevel ?? "Normal",
            action: alertAction,
          },
          voltageAlert: {
            action: voltageAlertAction,
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