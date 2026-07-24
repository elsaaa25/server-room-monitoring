"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react"
import Link from "next/link"
import {
  getSession,
  signOut,
} from "next-auth/react"
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Database,
  LoaderCircle,
  Menu,
  Radio,
  ShieldCheck,
  Thermometer,
  TrendingDown,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AlertHeaderButton } from "@/components/alert-header-button"
import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  defaultMonitoringSettings,
  type MonitoringSettings,
} from "@/lib/monitoring-settings"

type Floor = "4" | "5"
type Period = "1" | "6" | "24"

type RawReading = {
  id: number | string
  sensorId: string
  temperature: number
  voltage: number | null
  recordedAt: string
}

type ChartReading = {
  time: string
  timestamp: number
  temperature: number
  voltage: number | null
}

type Status =
  | "Normal"
  | "Waspada"
  | "Bahaya"

type HistoryResponse = {
  success?: boolean
  data?: unknown[]
  error?: string
  details?: string
}

type SettingsResponse = {
  success?: boolean
  data?: Partial<MonitoringSettings>
}

const SENSOR_L4 = "TEMP-L4"
const SENSOR_L5 = "esp32-lantai5"

const MAX_CHART_POINTS = 300

const periodConfigs: Record<
  Period,
  {
    hours: number
    limit: number
    label: string
  }
> = {
  "1": {
    hours: 1,
    limit: 300,
    label: "1 Jam Terakhir",
  },
  "6": {
    hours: 6,
    limit: 1_500,
    label: "6 Jam Terakhir",
  },
  "24": {
    hours: 24,
    limit: 6_000,
    label: "24 Jam Terakhir",
  },
}

function parseFiniteNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null
  }

  const result = Number(value)

  return Number.isFinite(result)
    ? result
    : null
}

function getNumberSetting(
  value: unknown,
  fallback: number,
): number {
  const parsed = parseFiniteNumber(value)

  return parsed ?? fallback
}

function clock(
  value: string | number | Date,
  seconds = false,
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: seconds
        ? "2-digit"
        : undefined,
      hourCycle: "h23",
    },
  ).format(date)
}

function chartAxisTime(
  value: string | number | Date,
  period: Period,
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  if (period === "24") {
    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      },
    ).format(date)
  }

  return clock(date)
}

function fullDate(
  value: string | Date,
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(date)
}

function fullDateTime(
  value: string | number | Date,
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    },
  ).format(date)
}

function normalizeReading(
  value: unknown,
): RawReading | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null
  }

  const reading = value as Record<
    string,
    unknown
  >

  const sensorId =
    typeof reading.sensorId === "string"
      ? reading.sensorId.trim()
      : ""

  const temperature =
    parseFiniteNumber(
      reading.temperature,
    )

  const voltage =
    parseFiniteNumber(
      reading.voltage,
    )

  const recordedAt =
    typeof reading.recordedAt ===
    "string"
      ? reading.recordedAt
      : ""

  const date = new Date(recordedAt)

  if (
    !sensorId ||
    temperature === null ||
    !recordedAt ||
    Number.isNaN(date.getTime())
  ) {
    return null
  }

  const id =
    typeof reading.id === "number" ||
    typeof reading.id === "string"
      ? reading.id
      : `${sensorId}-${recordedAt}`

  return {
    id,
    sensorId,
    temperature,
    voltage,
    recordedAt: date.toISOString(),
  }
}

function normalizeReadings(
  values: unknown[],
): RawReading[] {
  return values
    .map(normalizeReading)
    .filter(
      (
        reading,
      ): reading is RawReading =>
        reading !== null,
    )
    .sort(
      (first, second) =>
        new Date(
          second.recordedAt,
        ).getTime() -
        new Date(
          first.recordedAt,
        ).getTime(),
    )
}

function mergeHistoryReadings({
  previous,
  incoming,
  sensorId,
  hours,
  limit,
}: {
  previous: RawReading[]
  incoming: RawReading[]
  sensorId: string
  hours: number
  limit: number
}): RawReading[] {
  const cutoff =
    Date.now() -
    hours * 60 * 60 * 1000

  const readingMap = new Map<
    string,
    RawReading
  >()

  for (const reading of [
    ...incoming,
    ...previous,
  ]) {
    if (
      reading.sensorId !== sensorId
    ) {
      continue
    }

    const timestamp = new Date(
      reading.recordedAt,
    ).getTime()

    if (
      Number.isNaN(timestamp) ||
      timestamp < cutoff
    ) {
      continue
    }

    const key =
      `${reading.sensorId}-${String(
        reading.id,
      )}`

    if (!readingMap.has(key)) {
      readingMap.set(key, reading)
    }
  }

  return Array.from(
    readingMap.values(),
  )
    .sort(
      (first, second) =>
        new Date(
          second.recordedAt,
        ).getTime() -
        new Date(
          first.recordedAt,
        ).getTime(),
    )
    .slice(0, limit)
}

function downsampleChartData(
  data: ChartReading[],
  maximumPoints: number,
): ChartReading[] {
  if (data.length <= maximumPoints) {
    return data
  }

  const result: ChartReading[] = []

  const step =
    (data.length - 1) /
    (maximumPoints - 1)

  for (
    let index = 0;
    index < maximumPoints;
    index += 1
  ) {
    const sourceIndex = Math.round(
      index * step,
    )

    result.push(data[sourceIndex])
  }

  return result
}

function getTemperatureDomain(
  data: ChartReading[],
  warning: number,
  danger: number,
): [number, number] {
  const values = data
    .map(item => item.temperature)
    .filter(Number.isFinite)

  values.push(warning, danger)

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

  const difference =
    maximum - minimum

  const padding = Math.max(
    difference * 0.15,
    1,
  )

  return [
    Math.floor(
      (minimum - padding) * 10,
    ) / 10,
    Math.ceil(
      (maximum + padding) * 10,
    ) / 10,
  ]
}

function getVoltageDomain(
  data: ChartReading[],
): [number, number] {
  const values = data
    .map(item => item.voltage)
    .filter(
      (
        value,
      ): value is number =>
        value !== null &&
        Number.isFinite(value),
    )

  values.push(200, 220, 240)

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

  const difference =
    maximum - minimum

  const padding = Math.max(
    difference * 0.1,
    5,
  )

  return [
    Math.floor(minimum - padding),
    Math.ceil(maximum + padding),
  ]
}

function getSensorId(
  floor: Floor,
): string {
  return floor === "4"
    ? SENSOR_L4
    : SENSOR_L5
}

function getSensorLabel(
  sensorId: string,
): string {
  if (sensorId === SENSOR_L4) {
    return "Lantai 4 (Server)"
  }

  if (sensorId === SENSOR_L5) {
    return "Lantai 5 (Ruang Kerja)"
  }

  return sensorId
}

function getStatusColor(
  status: Status,
): string {
  if (status === "Bahaya") {
    return "text-rose-600 dark:text-rose-400"
  }

  if (status === "Waspada") {
    return "text-amber-500 dark:text-amber-400"
  }

  return "text-emerald-600 dark:text-emerald-400"
}

function getStatusBackground(
  status: Status,
): string {
  if (status === "Bahaya") {
    return (
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 " +
      "hover:bg-rose-500/15"
    )
  }

  if (status === "Waspada") {
    return (
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 " +
      "hover:bg-amber-500/15"
    )
  }

  return (
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 " +
    "hover:bg-emerald-500/15"
  )
}

async function readHistoryResponse(
  response: Response,
): Promise<RawReading[]> {
  const result =
    (await response.json()) as HistoryResponse

  if (
    !response.ok ||
    result.success === false
  ) {
    throw new Error(
      result.error ||
        result.details ||
        `Gagal mengambil data (${response.status})`,
    )
  }

  return normalizeReadings(
    Array.isArray(result.data)
      ? result.data
      : [],
  )
}

export function Dashboard() {
  const [
    activeFloor,
    setActiveFloor,
  ] = useState<Floor>("4")

  const [period, setPeriod] =
    useState<Period>("24")

  const [
    historyReadings,
    setHistoryReadings,
  ] = useState<RawReading[]>([])

  const [
    latestReadings,
    setLatestReadings,
  ] = useState<RawReading[]>([])

  const [settings, setSettings] =
    useState<MonitoringSettings>(
      defaultMonitoringSettings,
    )

  const [
    loadingHistory,
    setLoadingHistory,
  ] = useState(true)

  const [error, setError] =
    useState<string | null>(null)



  const latestRequestRunning =
    useRef(false)

  const activeSensorId =
    getSensorId(activeFloor)

  const warningTemperature =
    getNumberSetting(
      settings.warningTemperature,
      getNumberSetting(
        defaultMonitoringSettings
          .warningTemperature,
        27,
      ),
    )

  const dangerTemperature =
    getNumberSetting(
      settings.dangerTemperature,
      getNumberSetting(
        defaultMonitoringSettings
          .dangerTemperature,
        30,
      ),
    )

  const refreshInterval =
    Math.max(
      getNumberSetting(
        settings.refreshInterval,
        3,
      ),
      3,
    )

  const offlineTimeout =
    Math.max(
      getNumberSetting(
        settings.offlineTimeout,
        300,
      ),
      1,
    )

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch(
          "/api/settings",
          {
            cache: "no-store",
          },
        )

        if (!response.ok) {
          return
        }

        const result =
          (await response.json()) as SettingsResponse

        if (
          result.success &&
          result.data
        ) {
          setSettings(previous => ({
            ...previous,
            ...result.data,
          }))
        }
      } catch (settingsError) {
        console.error(
          "Gagal mengambil pengaturan:",
          settingsError,
        )
      }
    }

    void fetchSettings()

    function handleSettingsChanged(
      event: Event,
    ) {
      const customEvent =
        event as CustomEvent<
          MonitoringSettings
        >

      if (customEvent.detail) {
        setSettings(
          customEvent.detail,
        )
      }
    }

    window.addEventListener(
      "monitoring-settings-changed",
      handleSettingsChanged,
    )

    return () => {
      window.removeEventListener(
        "monitoring-settings-changed",
        handleSettingsChanged,
      )
    }
  }, [])



  /*
   * Riwayat penuh hanya dimuat saat:
   * - halaman pertama dibuka;
   * - lantai berubah;
   * - periode berubah.
   */
  const fetchHistory = useCallback(
    async (
      signal?: AbortSignal,
    ) => {
      setLoadingHistory(true)
      setError(null)

      const periodConfig =
        periodConfigs[period]

      try {
        const searchParams =
          new URLSearchParams({
            sensorId: activeSensorId,
            hours: String(
              periodConfig.hours,
            ),
            limit: String(
              periodConfig.limit,
            ),
          })

        const response = await fetch(
          `/api/sensor/history?${searchParams.toString()}`,
          {
            cache: "no-store",
            signal,
          },
        )

        const readings =
          await readHistoryResponse(
            response,
          )

        setHistoryReadings(
          readings.filter(
            reading =>
              reading.sensorId ===
              activeSensorId,
          ),
        )
      } catch (historyError) {
        if (
          historyError instanceof
            DOMException &&
          historyError.name ===
            "AbortError"
        ) {
          return
        }

        console.error(
          "Gagal memuat riwayat:",
          historyError,
        )

        setError(
          historyError instanceof Error
            ? historyError.message
            : "Gagal memuat riwayat sensor",
        )
      } finally {
        setLoadingHistory(false)
      }
    },
    [
      activeSensorId,
      period,
    ],
  )

  /*
   * Polling hanya mengambil beberapa
   * pembacaan terbaru, bukan seluruh
   * data periode berulang kali.
   */
  const fetchLatestReadings =
    useCallback(async () => {
      if (
        latestRequestRunning.current
      ) {
        return
      }

      latestRequestRunning.current =
        true

      try {
        const searchParams =
          new URLSearchParams({
            limit: "10",
          })

        const response = await fetch(
          `/api/sensor/history?${searchParams.toString()}`,
          {
            cache: "no-store",
          },
        )

        const readings =
          await readHistoryResponse(
            response,
          )

        setLatestReadings(readings)

        const activeLatest =
          readings.filter(
            reading =>
              reading.sensorId ===
              activeSensorId,
          )

        if (activeLatest.length > 0) {
          const periodConfig =
            periodConfigs[period]

          setHistoryReadings(
            previous =>
              mergeHistoryReadings({
                previous,
                incoming:
                  activeLatest,
                sensorId:
                  activeSensorId,
                hours:
                  periodConfig.hours,
                limit:
                  periodConfig.limit,
              }),
          )
        }
      } catch (latestError) {
        console.error(
          "Gagal memperbarui data terbaru:",
          latestError,
        )
      } finally {
        latestRequestRunning.current =
          false
      }
    }, [
      activeSensorId,
      period,
    ])

  useEffect(() => {
    const controller =
      new AbortController()

    void fetchHistory(
      controller.signal,
    )

    return () => {
      controller.abort()
    }
  }, [fetchHistory])

  useEffect(() => {
    void fetchLatestReadings()

    const timer =
      window.setInterval(() => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void fetchLatestReadings()
        }
      }, refreshInterval * 1000)

    const handleFocus = () => {
      void fetchLatestReadings()
    }

    window.addEventListener(
      "focus",
      handleFocus,
    )

    return () => {
      window.clearInterval(timer)

      window.removeEventListener(
        "focus",
        handleFocus,
      )
    }
  }, [
    fetchLatestReadings,
    refreshInterval,
  ])

  const readingL4 = useMemo(
    () =>
      latestReadings.find(
        reading =>
          reading.sensorId ===
          SENSOR_L4,
      ) ??
      historyReadings.find(
        reading =>
          reading.sensorId ===
          SENSOR_L4,
      ),
    [
      latestReadings,
      historyReadings,
    ],
  )

  const readingL5 = useMemo(
    () =>
      latestReadings.find(
        reading =>
          reading.sensorId ===
          SENSOR_L5,
      ) ??
      historyReadings.find(
        reading =>
          reading.sensorId ===
          SENSOR_L5,
      ),
    [
      latestReadings,
      historyReadings,
    ],
  )

  const isOnline = (
    reading: RawReading | undefined,
  ): boolean => {
    if (!reading) {
      return false
    }

    const timestamp = new Date(
      reading.recordedAt,
    ).getTime()

    if (Number.isNaN(timestamp)) {
      return false
    }

    const differenceSeconds =
      (Date.now() - timestamp) / 1000

    return (
      differenceSeconds <=
      offlineTimeout
    )
  }

  const getTempStatus = (
    temperature:
      | number
      | undefined,
  ): Status => {
    if (
      temperature === undefined
    ) {
      return "Normal"
    }

    if (
      temperature >=
      dangerTemperature
    ) {
      return "Bahaya"
    }

    if (
      temperature >=
      warningTemperature
    ) {
      return "Waspada"
    }

    return "Normal"
  }

  const onlineL4 =
    isOnline(readingL4)

  const onlineL5 =
    isOnline(readingL5)

  const statusL4 =
    getTempStatus(
      readingL4?.temperature,
    )

  const statusL5 =
    getTempStatus(
      readingL5?.temperature,
    )

  const chartData = useMemo(() => {
    const prepared =
      historyReadings
        .filter(
          reading =>
            reading.sensorId ===
            activeSensorId,
        )
        .map(
          reading =>
            ({
              time:
                reading.recordedAt,
              timestamp: new Date(
                reading.recordedAt,
              ).getTime(),
              temperature:
                Number(
                  reading.temperature,
                ),
              voltage:
                reading.voltage,
            }) satisfies ChartReading,
        )
        .filter(
          reading =>
            Number.isFinite(
              reading.temperature,
            ) &&
            !Number.isNaN(
              new Date(
                reading.time,
              ).getTime(),
            ),
        )
        .sort(
          (first, second) =>
            new Date(
              first.time,
            ).getTime() -
            new Date(
              second.time,
            ).getTime(),
        )

    return downsampleChartData(
      prepared,
      MAX_CHART_POINTS,
    )
  }, [
    historyReadings,
    activeSensorId,
  ])

  const hasTemperatureData =
    chartData.some(
      reading =>
        Number.isFinite(
          reading.temperature,
        ),
    )

  const hasVoltageData =
    chartData.some(
      reading =>
        reading.voltage !== null &&
        Number.isFinite(
          reading.voltage,
        ),
    )

  const temperatureDomain =
    useMemo(
      () =>
        getTemperatureDomain(
          chartData,
          warningTemperature,
          dangerTemperature,
        ),
      [
        chartData,
        warningTemperature,
        dangerTemperature,
      ],
    )

  const voltageDomain =
    useMemo(
      () =>
        getVoltageDomain(
          chartData,
        ),
      [chartData],
    )

  const activeTemperatures =
    useMemo(
      () =>
        historyReadings
          .filter(
            reading =>
              reading.sensorId ===
              activeSensorId,
          )
          .map(
            reading =>
              Number(
                reading.temperature,
              ),
          )
          .filter(Number.isFinite),
      [
        historyReadings,
        activeSensorId,
      ],
    )

  const maxTemp =
    activeTemperatures.length > 0
      ? Math.max(
          ...activeTemperatures,
        )
      : null

  const minTemp =
    activeTemperatures.length > 0
      ? Math.min(
          ...activeTemperatures,
        )
      : null

  const avgTemp =
    activeTemperatures.length > 0
      ? activeTemperatures.reduce(
          (total, temperature) =>
            total + temperature,
          0,
        ) /
        activeTemperatures.length
      : null

  const recentReadings =
    useMemo(
      () =>
        latestReadings.slice(0, 5),
      [latestReadings],
    )

  const initialLoading =
    loadingHistory &&
    historyReadings.length === 0

  return (
    <AppShell
      title="Monitoring Dashboard"
      actions={
        <>
          <HeaderClock />
          <AlertHeaderButton />
          <ProfilePanel />
        </>
      }
    >

        <div className="mb-6 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={activeFloor}
            onValueChange={value =>
              setActiveFloor(
                value as Floor,
              )
            }
            className="w-full sm:w-auto"
          >
           < TabsList className="grid h-12 w-full grid-cols-2 gap-1 rounded-full bg-muted p-1 sm:w-[590px]">
  <TabsTrigger
    value="4"
    className="flex h-full items-center justify-center whitespace-nowrap rounded-full px-4 py-0 text-sm font-semibold leading-none transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
  >
    Lantai 4 - Ruang Server
  </TabsTrigger>

  <TabsTrigger
    value="5"
    className="flex h-full items-center justify-center whitespace-nowrap rounded-full px-4 py-0 text-sm font-semibold leading-none transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
  >
    Lantai 5 - Ruang ATC
  </TabsTrigger>
</TabsList>
          </Tabs>

          <Tabs
            value={period}
            onValueChange={value =>
              setPeriod(
                value as Period,
              )
            }
            className="w-full sm:w-auto"
          >
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1 sm:w-auto">
              <TabsTrigger
                value="1"
                className="whitespace-nowrap rounded-lg px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                1 Jam
              </TabsTrigger>

              <TabsTrigger
                value="6"
                className="whitespace-nowrap rounded-lg px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                6 Jam
              </TabsTrigger>

              <TabsTrigger
                value="24"
                className="whitespace-nowrap rounded-lg px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                24 Jam
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {error && (
          <Card className="mb-4 border-rose-200 bg-rose-50 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
            <CardContent className="p-4">
              <p className="font-medium text-rose-700 dark:text-rose-300">
                Gagal memuat data sensor
              </p>

              <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">
                {error}
              </p>
            </CardContent>
          </Card>
        )}

        {initialLoading ? (
          <div className="grid min-h-[50vh] place-items-center">
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-7 animate-spin" />

              <span>
                Menghubungkan ke database Supabase...
              </span>
            </div>
          </div>
        ) : (
          <>
            {activeFloor === "4" && (
              <div>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    icon={Thermometer}
                    label="Suhu Ruang Server"
                    value={
                      readingL4
                        ? `${Number(Number(readingL4.temperature).toFixed(1))}°C`
                        : "--°C"
                    }
                    detail={
                      readingL4
                        ? `Status: ${statusL4}`
                        : "Belum ada data"
                    }
                    valueClassName={
                      readingL4
                        ? getStatusColor(
                            statusL4,
                          )
                        : "text-muted-foreground"
                    }
                  />

                  <Metric
                    icon={Zap}
                    label="Tegangan"
                    value={
                      readingL4?.voltage !==
                        null &&
                      readingL4?.voltage !==
                        undefined
                        ? `${Number(Number(readingL4.voltage).toFixed(1))} V`
                        : "-- V"
                    }
                    detail={
                      readingL4?.voltage !==
                        null &&
                      readingL4?.voltage !==
                        undefined
                        ? readingL4.voltage >=
                            200 &&
                          readingL4.voltage <=
                            240
                          ? "Normal (Stabil)"
                          : "Tegangan tidak stabil"
                        : "Tidak ada data"
                    }
                    valueClassName={
                      readingL4?.voltage !==
                        null &&
                      readingL4?.voltage !==
                        undefined
                        ? readingL4.voltage >=
                            200 &&
                          readingL4.voltage <=
                            240
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground"
                    }
                  />

                  <Metric
                    icon={Radio}
                    label="Status Sensor L4"
                    value={
                      onlineL4
                        ? "Online"
                        : "Offline"
                    }
                    detail={
                      readingL4
                        ? `Update: ${clock(
                            readingL4.recordedAt,
                            true,
                          )}`
                        : "Belum ada data"
                    }
                    valueClassName={
                      onlineL4
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }
                  />

                  <Metric
                    icon={ShieldCheck}
                    label="Kondisi Ruangan L4"
                    value={
                      !onlineL4
                        ? "-"
                        : statusL4 ===
                            "Bahaya"
                          ? "BAHAYA"
                          : statusL4 ===
                              "Waspada"
                            ? "WASPADA"
                            : "AMAN"
                    }
                    detail={
                      !onlineL4
                        ? "Sensor terputus"
                        : statusL4 ===
                            "Normal"
                          ? "Suhu ruang server aman"
                          : "Segera periksa AC server"
                    }
                    valueClassName={
                      !onlineL4
                        ? "text-muted-foreground"
                        : getStatusColor(
                            statusL4,
                          )
                    }
                  />
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  <Card className="overflow-hidden border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-semibold text-foreground">
                        Grafik Tren Suhu Lantai 4
                      </CardTitle>

                      <p className="text-[11px] text-muted-foreground">
                        Suhu ruang server •{" "}
                        {
                          periodConfigs[
                            period
                          ].label
                        }
                      </p>
                    </CardHeader>

                    <CardContent className="h-72 pl-1 pr-4 pb-4">
                      {loadingHistory &&
                      chartData.length ===
                        0 ? (
                        <ChartMessage
                          loading
                          message="Memuat grafik suhu..."
                        />
                      ) : !hasTemperatureData ? (
                        <ChartMessage message="Belum ada data suhu pada periode ini." />
                      ) : (
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                        >
                          <AreaChart
                            data={
                              chartData
                            }
                            margin={{
                              top: 16,
                              right: 20,
                              left: -5,
                              bottom: 5,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id="tempL4Grad"
                                x1="0"
                                x2="0"
                                y1="0"
                                y2="1"
                              >
                                <stop
                                  offset="0"
                                  stopColor="#10b981"
                                  stopOpacity={
                                    0.2
                                  }
                                />

                                <stop
                                  offset="1"
                                  stopColor="#10b981"
                                  stopOpacity={
                                    0
                                  }
                                />
                              </linearGradient>
                            </defs>

                            <CartesianGrid
                              vertical={
                                false
                              }
                              stroke="var(--border)"
                            />

                            <XAxis
                              dataKey="timestamp"
                              type="number"
                              scale="time"
                              domain={[
                                "dataMin",
                                "dataMax",
                              ]}
                              tickCount={6}
                              tickFormatter={value =>
                                chartAxisTime(
                                  Number(value),
                                  period,
                                )
                              }
                              axisLine={
                                false
                              }
                              tickLine={
                                false
                              }
                              minTickGap={
                                45
                              }
                              fontSize={
                                11
                              }
                              tick={{ fill: "var(--muted-foreground)" }}
                            />

                            <YAxis
                              domain={[16, 30]}
                              ticks={[
                                16,
                                18,
                                20,
                                22,
                                24,
                                26,
                                28,
                                30,
                              ]}
                              axisLine={false}
                              tickLine={false}
                              fontSize={11}
                              width={48}
                              tickFormatter={value =>
                                String(Number(value))
                              }
                              tick={{ fill: "var(--muted-foreground)" }}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="rounded-xl border border-border bg-popover p-2.5 shadow-md text-popover-foreground text-xs font-semibold">
                                      <p className="font-mono text-muted-foreground mb-1">{fullDateTime(Number(label))}</p>
                                      {payload.map((p, idx) => (
                                        <p key={idx} className="flex items-center gap-1.5 text-xs">
                                          <span className="size-1.5 rounded-full" style={{ backgroundColor: p.color || p.stroke }} />
                                          <span className="text-muted-foreground font-medium">Suhu:</span>
                                          <span className="font-bold">{Number(Number(p.value).toFixed(1))}°C</span>
                                        </p>
                                      ))}
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />

                            <ReferenceLine
                              y={
                                dangerTemperature
                              }
                              ifOverflow="extendDomain"
                              stroke="#fb7185"
                              strokeDasharray="5 4"
                              label={{
                                value:
                                  `Bahaya (≥${dangerTemperature}°C)`,
                                fill: "#f43f5e",
                                fontSize: 10,
                                position:
                                  "insideTopLeft",
                              }}
                            />

                            <ReferenceLine
                              y={
                                warningTemperature
                              }
                              ifOverflow="extendDomain"
                              stroke="#f59e0b"
                              strokeDasharray="5 4"
                              label={{
                                value:
                                  `Waspada (≥${warningTemperature}°C)`,
                                fill: "#d97706",
                                fontSize: 10,
                                position:
                                  "insideTopLeft",
                              }}
                            />

                            <Area
                              type="monotone"
                              dataKey="temperature"
                              stroke="#10b981"
                              strokeWidth={
                                2.4
                              }
                              fill="url(#tempL4Grad)"
                              connectNulls
                              isAnimationActive={
                                false
                              }
                              dot={
                                chartData.length ===
                                1
                                  ? {
                                      r: 4,
                                      fill: "#10b981",
                                      strokeWidth: 0,
                                    }
                                  : false
                              }
                              activeDot={{
                                r: 5,
                                fill: "#059669",
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-semibold text-foreground">
                        Grafik Tegangan AC Lantai 4
                      </CardTitle>

                      <p className="text-[11px] text-muted-foreground">
                        Tegangan listrik •{" "}
                        {
                          periodConfigs[
                            period
                          ].label
                        }
                      </p>
                    </CardHeader>

                    <CardContent className="h-72 pl-1 pr-4 pb-4">
                      {loadingHistory &&
                      chartData.length ===
                        0 ? (
                        <ChartMessage
                          loading
                          message="Memuat grafik tegangan..."
                        />
                      ) : !hasVoltageData ? (
                        <ChartMessage message="Belum ada data tegangan dari sensor." />
                      ) : (
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                        >
                          <AreaChart
                            data={
                              chartData
                            }
                            margin={{
                              top: 16,
                              right: 20,
                              left: -5,
                              bottom: 5,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id="voltL4Grad"
                                x1="0"
                                x2="0"
                                y1="0"
                                y2="1"
                              >
                                <stop
                                  offset="0"
                                  stopColor="#d97706"
                                  stopOpacity={
                                    0.15
                                  }
                                />

                                <stop
                                  offset="1"
                                  stopColor="#d97706"
                                  stopOpacity={
                                    0
                                  }
                                />
                              </linearGradient>
                            </defs>

                            <CartesianGrid
                              vertical={
                                false
                              }
                              stroke="var(--border)"
                            />

                            <XAxis
                              dataKey="timestamp"
                              type="number"
                              scale="time"
                              domain={[
                                "dataMin",
                                "dataMax",
                              ]}
                              tickCount={6}
                              tickFormatter={value =>
                                chartAxisTime(
                                  Number(value),
                                  period,
                                )
                              }
                              axisLine={
                                false
                              }
                              tickLine={
                                false
                              }
                              minTickGap={
                                45
                              }
                              fontSize={
                                11
                              }
                              tick={{ fill: "var(--muted-foreground)" }}
                            />

                            <YAxis
                              domain={[200, 240]}
                              ticks={[200, 210, 220, 230, 240]}
                              axisLine={
                                false
                              }
                              tickLine={
                                false
                              }
                              fontSize={
                                11
                              }
                              width={48}
                              tickFormatter={value =>
                                String(Number(value))
                              }
                              tick={{ fill: "var(--muted-foreground)" }}
                            />

                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="rounded-xl border border-border bg-popover p-2.5 shadow-md text-popover-foreground text-xs font-semibold">
                                      <p className="font-mono text-muted-foreground mb-1">{fullDateTime(Number(label))}</p>
                                      {payload.map((p, idx) => (
                                        <p key={idx} className="flex items-center gap-1.5 text-xs">
                                          <span className="size-1.5 rounded-full" style={{ backgroundColor: p.color || p.stroke }} />
                                          <span className="text-muted-foreground font-medium">Tegangan:</span>
                                          <span className="font-bold">{Number(Number(p.value).toFixed(1))} V</span>
                                        </p>
                                      ))}
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />

                            <ReferenceLine
                              y={220}
                              ifOverflow="extendDomain"
                              stroke="#3b82f6"
                              strokeDasharray="4 4"
                              label={{
                                value:
                                  "Target 220 V",
                                fill: "#2563eb",
                                fontSize: 10,
                                position:
                                  "insideTopLeft",
                              }}
                            />

                            <ReferenceLine
                              y={200}
                              ifOverflow="extendDomain"
                              stroke="#f43f5e"
                              strokeDasharray="4 4"
                            />

                            <ReferenceLine
                              y={240}
                              ifOverflow="extendDomain"
                              stroke="#f43f5e"
                              strokeDasharray="4 4"
                            />

                            <Area
                              type="monotone"
                              dataKey="voltage"
                              stroke="#d97706"
                              strokeWidth={
                                2.4
                              }
                              fill="url(#voltL4Grad)"
                              connectNulls
                              isAnimationActive={
                                false
                              }
                              dot={
                                chartData.length ===
                                1
                                  ? {
                                      r: 4,
                                      fill: "#d97706",
                                      strokeWidth: 0,
                                    }
                                  : false
                              }
                              activeDot={{
                                r: 5,
                                fill: "#b45309",
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </section>
              </div>
            )}

            {activeFloor === "5" && (
              <div>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Metric
                    icon={Thermometer}
                    label="Suhu Ruangan L5"
                    value={
                      readingL5
                        ? `${Number(Number(readingL5.temperature).toFixed(1))}°C`
                        : "--°C"
                    }
                    detail={
                      readingL5
                        ? `Status: ${statusL5}`
                        : "Belum ada data"
                    }
                    valueClassName={
                      readingL5
                        ? getStatusColor(
                            statusL5,
                          )
                        : "text-muted-foreground"
                    }
                  />

                  <Metric
                    icon={Radio}
                    label="Status Sensor L5"
                    value={
                      onlineL5
                        ? "Online"
                        : "Offline"
                    }
                    detail={
                      readingL5
                        ? `Update: ${clock(
                            readingL5.recordedAt,
                            true,
                          )}`
                        : "Belum ada data"
                    }
                    valueClassName={
                      onlineL5
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }
                  />

                  <Metric
                    icon={ShieldCheck}
                    label="Kondisi Ruangan L5"
                    value={
                      !onlineL5
                        ? "-"
                        : statusL5 ===
                            "Bahaya"
                          ? "BAHAYA"
                          : statusL5 ===
                              "Waspada"
                            ? "WASPADA"
                            : "AMAN"
                    }
                    detail={
                      !onlineL5
                        ? "Sensor terputus"
                        : statusL5 ===
                            "Normal"
                          ? "Suhu ruangan normal"
                          : "Periksa kondisi AC Lantai 5"
                    }
                    valueClassName={
                      !onlineL5
                        ? "text-muted-foreground"
                        : getStatusColor(
                            statusL5,
                          )
                    }
                  />
                </section>

                <section className="mt-6">
                  <Card className="overflow-hidden border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-semibold text-foreground">
                        Grafik Tren Suhu Lantai 5
                      </CardTitle>

                      <p className="text-[11px] text-muted-foreground">
                        Suhu ruang kerja •{" "}
                        {
                          periodConfigs[
                            period
                          ].label
                        }
                      </p>
                    </CardHeader>

                    <CardContent className="h-80 pl-1">
                      {loadingHistory &&
                      chartData.length ===
                        0 ? (
                        <ChartMessage
                          loading
                          message="Memuat grafik suhu..."
                        />
                      ) : !hasTemperatureData ? (
                        <ChartMessage message="Sensor suhu Lantai 5 belum mengirim data." />
                      ) : (
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                        >
                          <AreaChart
                            data={
                              chartData
                            }
                            margin={{
                              top: 16,
                              right: 20,
                              left: -5,
                              bottom: 5,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id="tempL5Grad"
                                x1="0"
                                x2="0"
                                y1="0"
                                y2="1"
                              >
                                <stop
                                  offset="0"
                                  stopColor="#8b5cf6"
                                  stopOpacity={
                                    0.2
                                  }
                                />

                                <stop
                                  offset="1"
                                  stopColor="#8b5cf6"
                                  stopOpacity={
                                    0
                                  }
                                />
                              </linearGradient>
                            </defs>

                            <CartesianGrid
                              vertical={
                                false
                              }
                              stroke="var(--border)"
                            />

                            <XAxis
                              dataKey="timestamp"
                              type="number"
                              scale="time"
                              domain={[
                                "dataMin",
                                "dataMax",
                              ]}
                              tickCount={6}
                              tickFormatter={value =>
                                chartAxisTime(
                                  Number(value),
                                  period,
                                )
                              }
                              axisLine={
                                false
                              }
                              tickLine={
                                false
                              }
                              minTickGap={
                                45
                              }
                              fontSize={
                                11
                              }
                              tick={{ fill: "var(--muted-foreground)" }}
                            />

                            <YAxis
                              domain={[16, 30]}
                              ticks={[
                                16,
                                18,
                                20,
                                22,
                                24,
                                26,
                                28,
                                30,
                              ]}
                              axisLine={
                                false
                              }
                              tickLine={
                                false
                              }
                              fontSize={
                                11
                              }
                              width={48}
                              tickFormatter={value =>
                                String(Number(value))
                              }
                              tick={{ fill: "var(--muted-foreground)" }}
                            />

                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="rounded-xl border border-border bg-popover p-2.5 shadow-md text-popover-foreground text-xs font-semibold">
                                      <p className="font-mono text-muted-foreground mb-1">{fullDateTime(Number(label))}</p>
                                      {payload.map((p, idx) => (
                                        <p key={idx} className="flex items-center gap-1.5 text-xs">
                                          <span className="size-1.5 rounded-full" style={{ backgroundColor: p.color || p.stroke }} />
                                          <span className="text-muted-foreground font-medium">Suhu:</span>
                                          <span className="font-bold">{Number(Number(p.value).toFixed(1))}°C</span>
                                        </p>
                                      ))}
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />

                            <ReferenceLine
                              y={
                                dangerTemperature
                              }
                              ifOverflow="extendDomain"
                              stroke="#fb7185"
                              strokeDasharray="5 4"
                            />

                            <ReferenceLine
                              y={
                                warningTemperature
                              }
                              ifOverflow="extendDomain"
                              stroke="#f59e0b"
                              strokeDasharray="5 4"
                            />

                            <Area
                              type="monotone"
                              dataKey="temperature"
                              stroke="#8b5cf6"
                              strokeWidth={
                                2.4
                              }
                              fill="url(#tempL5Grad)"
                              connectNulls
                              isAnimationActive={
                                false
                              }
                              dot={
                                chartData.length ===
                                1
                                  ? {
                                      r: 4,
                                      fill: "#8b5cf6",
                                      strokeWidth: 0,
                                    }
                                  : false
                              }
                              activeDot={{
                                r: 5,
                                fill: "#7c3aed",
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </section>
              </div>
            )}

            <section className="mt-6 grid gap-6 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Ambang Batas Suhu
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-2">
                  <Limit
                    color="bg-emerald-500"
                    label="Normal"
                    value={`< ${warningTemperature}°C`}
                  />

                  <Limit
                    color="bg-amber-400"
                    label="Waspada"
                    value={`${warningTemperature}°C – < ${dangerTemperature}°C`}
                  />

                  <Limit
                    color="bg-rose-500"
                    label="Bahaya"
                    value={`≥ ${dangerTemperature}°C`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Status Koneksi Sistem
                  </CardTitle>
                </CardHeader>

                <CardContent className="divide-y">
                  <SystemRow
                    icon={CheckCircle2}
                    label="Dashboard Vercel"
                  />

                  <SystemRow
                    icon={Database}
                    label="Postgres Supabase"
                  />

                  <SystemRow
                    icon={Radio}
                    label="Sensor L4 (Server)"
                    online={onlineL4}
                  />

                  <SystemRow
                    icon={Radio}
                    label="Sensor L5 (Ruangan)"
                    online={onlineL5}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Ringkasan{" "}
                    {
                      periodConfigs[
                        period
                      ].label
                    }{" "}
                    (
                    {activeFloor === "4"
                      ? "Lantai 4"
                      : "Lantai 5"}
                    )
                  </CardTitle>
                </CardHeader>

                <CardContent className="divide-y">
                  <SummaryRow
                    icon={TrendingUp}
                    label="Suhu Tertinggi"
                    value={
                      maxTemp !== null
                        ? `${Number(Number(maxTemp).toFixed(1))}°C`
                        : "--°C"
                    }
                    color="bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  />

                  <SummaryRow
                    icon={TrendingDown}
                    label="Suhu Terendah"
                    value={
                      minTemp !== null
                        ? `${Number(Number(minTemp).toFixed(1))}°C`
                        : "--°C"
                    }
                    color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  />

                  <SummaryRow
                    icon={Activity}
                    label="Rata-rata Suhu"
                    value={
                      avgTemp !== null
                        ? `${Number(Number(avgTemp).toFixed(1))}°C`
                        : "--°C"
                    }
                    color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  />
                </CardContent>
              </Card>
            </section>

            <section className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    5 Pembacaan Terakhir
                  </CardTitle>

                  <Link
                    href="/riwayat"
                    className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Lihat Semua Riwayat
                  </Link>
                </CardHeader>

                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">
                          Waktu
                        </TableHead>

                        <TableHead>
                          Identitas Sensor
                        </TableHead>

                        <TableHead>
                          Suhu (°C)
                        </TableHead>

                        <TableHead>
                          Tegangan (V)
                        </TableHead>

                        <TableHead className="pr-6">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {recentReadings.length >
                      0 ? (
                        recentReadings.map(
                          row => {
                            const status =
                              getTempStatus(
                                row.temperature,
                              )

                            return (
                              <TableRow
                                key={`${row.sensorId}-${row.id}`}
                              >
                                <TableCell className="pl-6">
                                  {fullDateTime(
                                    row.recordedAt,
                                  )}
                                </TableCell>

                                <TableCell>
                                  <code className="rounded bg-muted px-2 py-1 font-mono text-xs font-medium text-foreground/80">
                                    {getSensorLabel(
                                      row.sensorId,
                                    )}
                                  </code>
                                </TableCell>

                                <TableCell className="font-semibold text-foreground">
                                  {Number(Number(row.temperature).toFixed(1))}
                                  °C
                                </TableCell>

                                <TableCell className="text-muted-foreground">
                                  {row.voltage !==
                                  null
                                    ? `${Number(Number(row.voltage).toFixed(1))} V`
                                    : "-- V"}
                                </TableCell>

                                <TableCell className="pr-6">
                                  <Badge
                                    variant="secondary"
                                    className={getStatusBackground(
                                      status,
                                    )}
                                  >
                                    ● {status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          },
                        )
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="h-20 text-center text-muted-foreground"
                          >
                            Menunggu pengiriman data dari sensor...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </AppShell>
    )
  }

function HeaderClock() {
  const [now, setNow] =
    useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())

    const timer =
      window.setInterval(() => {
        setNow(new Date())
      }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return (
    <span className="hidden items-center gap-2 text-sm text-muted-foreground xl:flex">
      <CalendarDays className="size-4" />

      {now
        ? `${fullDate(now)}, ${clock(
            now,
            true,
          )} WIB`
        : "Memuat waktu..."}
    </span>
  )
}

function ChartMessage({
  loading = false,
  message,
}: {
  loading?: boolean
  message: string
}) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
      <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
        {loading ? (
          <LoaderCircle className="size-7 animate-spin text-primary" />
        ) : (
          <Activity className="size-8 text-muted-foreground/30" />
        )}

        <p className="text-sm text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  valueClassName = "text-emerald-600 dark:text-emerald-400",
}: {
  icon: ComponentType<{
    className?: string
  }>
  label: string
  value: string
  detail: string
  valueClassName?: string
}) {
  return (
    <Card className="border-border/60 bg-card shadow-xs transition-shadow hover:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground/75" />
      </CardHeader>
      <CardContent className="space-y-1">
        <div className={`text-2xl font-bold tracking-tight ${valueClassName}`}>
          {value}
        </div>
        <p className="text-[11px] font-medium text-muted-foreground/80">
          {detail}
        </p>
      </CardContent>
    </Card>
  )
}

function Limit({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center rounded-xl border px-3 py-3 text-xs font-semibold">
      <span
        className={`mr-3 size-2 rounded-full ${color}`}
      />

      <span className="text-muted-foreground">
        {label}
      </span>

      <b className="ml-auto text-foreground">
        {value}
      </b>
    </div>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: ComponentType<{
    className?: string
  }>
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <span
        className={`grid size-11 place-items-center rounded-full ${color}`}
      >
        <Icon className="size-5" />
      </span>

      <span>
        <small className="block text-[11px] font-medium leading-tight text-muted-foreground">
          {label}
        </small>

        <b className="block text-base font-bold text-foreground">
          {value}
        </b>
      </span>
    </div>
  )
}

function SystemRow({
  icon: Icon,
  label,
  online = true,
}: {
  icon: ComponentType<{
    className?: string
  }>
  label: string
  online?: boolean
}) {
  return (
    <div className="flex items-center py-3 text-xs font-semibold">
      <Icon
        className={`mr-2 size-4 ${
          online
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      />

      <span className="text-muted-foreground">
        {label}
      </span>

      <span
        className={`ml-auto ${
          online
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {online
          ? "Online"
          : "Offline"}
      </span>
    </div>
  )
}

function ProfilePanel() {
  const [profile, setProfile] =
    useState<{
      name?: string | null
      email?: string | null
      role?: string
    } | null>(null)

  useEffect(() => {
    let active = true

    getSession()
      .then(session => {
        if (active) {
          setProfile(
            session?.user ?? null,
          )
        }
      })
      .catch(error => {
        console.error(
          "Gagal mengambil profil:",
          error,
        )
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
        >
          <UserRound />

          <span className="hidden sm:inline">
            {profile?.name ??
              "Pengguna"}
          </span>

          <ChevronDown className="size-4" />
        </Button>
      </SheetTrigger>

      <SheetContent>
        <SheetTitle>
          Profil Pengguna
        </SheetTitle>

        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-muted p-4">
          <div className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <UserRound />
          </div>

          <div className="min-w-0">
            <b className="block truncate text-foreground">
              {profile?.name ??
                "Memuat..."}
            </b>

            <span className="block truncate text-xs text-muted-foreground">
              {profile?.email}
            </span>

            <Badge className="mt-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
              {profile?.role ?? "-"}
            </Badge>
          </div>
        </div>

        <nav className="mt-6 space-y-2">
          {profile?.role ===
            "ADMIN" && (
            <Button
              asChild
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
            >
              <Link href="/pengaturan">
                Pengaturan sistem
              </Link>
            </Button>
          )}

          <Button
            asChild
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <Link href="/riwayat">
              Riwayat monitoring
            </Link>
          </Button>

          <Button
            asChild
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <Link href="/peringatan">
              Pusat peringatan
            </Link>
          </Button>

          <Button
            variant="outline"
            className="mt-4 w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() =>
              signOut({
                callbackUrl:
                  "/login",
              })
            }
          >
            Keluar
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
