"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react"
import {
  Activity,
  CalendarDays,
  Download,
  LoaderCircle,
  RefreshCw,
  Thermometer,
  TriangleAlert,
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

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

type Period = "1" | "6" | "24" | "168"

type MetricKey =
  | "temperatureL4"
  | "temperatureL5"
  | "voltage"
  | "current"

type HistoryReading = {
  id: number | string
  sensorId: string
  temperature: number | string | null
  voltage?: number | string | null
  recordedAt: string
}

type HistoryResponse = {
  success?: boolean
  data?: HistoryReading[]
  error?: string
  details?: string
}

type SettingsResponse = {
  success?: boolean
  data?: {
    warningTemperature?: number | string
    dangerTemperature?: number | string
    refreshInterval?: number | string
  }
}

type GraphPoint = {
  id: string
  time: string
  temperatureL4: number | null
  temperatureL5: number | null
  voltage: number | null
  current: number | null
}

type MetricStats = {
  hasData: boolean
  latest: number | null
  minimum: number | null
  maximum: number | null
  average: number | null
}

type MetricChartProps = {
  data: GraphPoint[]
  period: Period
  dataKey: MetricKey
  title: string
  description: string
  unit: string
  decimals: number
  stroke: string
  gradientId: string
  warning?: number
  danger?: number
  loading?: boolean
  emptyMessage?: string
}

type SummaryCardProps = {
  icon: ComponentType<{
    className?: string
  }>
  label: string
  value: string
  description: string
  color:
    | "emerald"
    | "blue"
    | "amber"
    | "violet"
  available?: boolean
}

const SENSOR_ID = "TEMP-L4"

const DEFAULT_WARNING_TEMPERATURE = 27
const DEFAULT_DANGER_TEMPERATURE = 30
const DEFAULT_REFRESH_SECONDS = 3

const MAX_CHART_POINTS = 360

const periodConfigs: Record<
  Period,
  {
    hours: number
    limit: number
    label: string
    fileLabel: string
  }
> = {
  "1": {
    hours: 1,
    limit: 300,
    label: "1 Jam",
    fileLabel: "1-jam",
  },
  "6": {
    hours: 6,
    limit: 1_500,
    label: "6 Jam",
    fileLabel: "6-jam",
  },
  "24": {
    hours: 24,
    limit: 6_000,
    label: "24 Jam",
    fileLabel: "24-jam",
  },
  "168": {
    hours: 168,
    limit: 41_000,
    label: "7 Hari",
    fileLabel: "7-hari",
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

  const number = Number(value)

  return Number.isFinite(number)
    ? number
    : null
}

function formatAxisTime(
  value: string,
  period: Period,
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  if (period === "168") {
    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
      },
    ).format(date)
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date)
}

function formatFullDate(
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

function formatDateTime(
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
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  ).format(date)
}

function formatCsvDateTime(
  value: string | Date,
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    },
  ).formatToParts(date)

  const values: Record<string, string> = {}

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value
    }
  }

  return (
    `${values.year}-${values.month}-${values.day} ` +
    `${values.hour}:${values.minute}:${values.second}`
  )
}

function mapHistoryReading(
  reading: HistoryReading,
): GraphPoint | null {
  const temperature =
    parseFiniteNumber(reading.temperature)

  const date = new Date(reading.recordedAt)

  if (
    temperature === null ||
    Number.isNaN(date.getTime())
  ) {
    return null
  }

  return {
    id: String(reading.id),
    time: date.toISOString(),

    // Data asli yang sudah tersedia.
    temperatureL4: temperature,

    // Sensor berikutnya belum tersedia.
    temperatureL5: null,
    voltage: null,
    current: null,
  }
}

function mapHistoryData(
  readings: HistoryReading[],
): GraphPoint[] {
  return readings
    .map(mapHistoryReading)
    .filter(
      (
        reading,
      ): reading is GraphPoint =>
        reading !== null,
    )
    .sort(
      (first, second) =>
        new Date(first.time).getTime() -
        new Date(second.time).getTime(),
    )
}

function calculateMetricStats(
  data: GraphPoint[],
  key: MetricKey,
): MetricStats {
  let count = 0
  let total = 0

  let latest: number | null = null
  let minimum: number | null = null
  let maximum: number | null = null

  for (const item of data) {
    const value = item[key]

    if (
      value === null ||
      !Number.isFinite(value)
    ) {
      continue
    }

    count += 1
    total += value
    latest = value

    minimum =
      minimum === null
        ? value
        : Math.min(minimum, value)

    maximum =
      maximum === null
        ? value
        : Math.max(maximum, value)
  }

  if (
    count === 0 ||
    latest === null ||
    minimum === null ||
    maximum === null
  ) {
    return {
      hasData: false,
      latest: null,
      minimum: null,
      maximum: null,
      average: null,
    }
  }

  return {
    hasData: true,
    latest,
    minimum,
    maximum,
    average: total / count,
  }
}

function calculateYAxisDomain(
  data: GraphPoint[],
  key: MetricKey,
  warning?: number,
  danger?: number,
): [number, number] {
  const values: number[] = []

  for (const item of data) {
    const value = item[key]

    if (
      value !== null &&
      Number.isFinite(value)
    ) {
      values.push(value)
    }
  }

  if (
    warning !== undefined &&
    Number.isFinite(warning)
  ) {
    values.push(warning)
  }

  if (
    danger !== undefined &&
    Number.isFinite(danger)
  ) {
    values.push(danger)
  }

  if (values.length === 0) {
    return [0, 10]
  }

  let minimum = values[0]
  let maximum = values[0]

  for (const value of values) {
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }

  const difference = maximum - minimum

  const minimumPadding =
    key === "voltage"
      ? 2
      : key === "current"
        ? 0.2
        : 1

  const padding = Math.max(
    difference * 0.15,
    minimumPadding,
  )

  let finalMin = minimum - padding
  let finalMax = maximum + padding

  if (key !== "current") {
    finalMin = Math.floor(finalMin)
    finalMax = Math.ceil(finalMax)
  } else {
    finalMin = Number(finalMin.toFixed(2))
    finalMax = Number(finalMax.toFixed(2))
  }

  return [finalMin, finalMax]
}

function downsampleData(
  data: GraphPoint[],
  maximumPoints: number,
): GraphPoint[] {
  if (data.length <= maximumPoints) {
    return data
  }

  const result: GraphPoint[] = []
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

function getMetricValue(
  value: number | null,
  decimals: number,
  unit: string,
): string {
  if (value === null) {
    return "-"
  }

  return `${value.toFixed(decimals)}${unit}`
}

function getHistoryUrl(
  period: Period,
): string {
  const config =
    periodConfigs[period]

  const searchParams =
    new URLSearchParams({
      sensorId: SENSOR_ID,
      hours: String(config.hours),
      limit: String(config.limit),
    })

  return `/api/sensor/history?${searchParams.toString()}`
}

function getLatestReadingUrl(): string {
  const searchParams =
    new URLSearchParams({
      sensorId: SENSOR_ID,
      limit: "1",
    })

  return `/api/sensor/history?${searchParams.toString()}`
}

async function readHistoryResponse(
  response: Response,
): Promise<HistoryResponse> {
  const result =
    (await response.json()) as HistoryResponse

  if (!response.ok) {
    throw new Error(
      result.error ||
        result.details ||
        `Gagal mengambil data (${response.status})`,
    )
  }

  return result
}

export function GraphPage() {
  const [period, setPeriod] =
    useState<Period>("24")

  const [data, setData] =
    useState<GraphPoint[]>([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null)

  const [
    warningTemperature,
    setWarningTemperature,
  ] = useState(
    DEFAULT_WARNING_TEMPERATURE,
  )

  const [
    dangerTemperature,
    setDangerTemperature,
  ] = useState(
    DEFAULT_DANGER_TEMPERATURE,
  )

  const [
    refreshSeconds,
    setRefreshSeconds,
  ] = useState(
    DEFAULT_REFRESH_SECONDS,
  )

  const latestRequestRunning =
    useRef(false)

  const loadSettings =
    useCallback(async () => {
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

        const warning =
          parseFiniteNumber(
            result.data
              ?.warningTemperature,
          )

        const danger =
          parseFiniteNumber(
            result.data
              ?.dangerTemperature,
          )

        const refresh =
          parseFiniteNumber(
            result.data
              ?.refreshInterval,
          )

        if (warning !== null) {
          setWarningTemperature(warning)
        }

        if (danger !== null) {
          setDangerTemperature(danger)
        }

        if (
          refresh !== null &&
          refresh >= 1
        ) {
          setRefreshSeconds(
            Math.floor(refresh),
          )
        }
      } catch (settingsError) {
        console.error(
          "Gagal mengambil pengaturan grafik:",
          settingsError,
        )
      }
    }, [])

  const loadHistory =
    useCallback(
      async (
        selectedPeriod: Period,
        signal?: AbortSignal,
      ) => {
        setLoading(true)
        setError(null)

        try {
          const response = await fetch(
            getHistoryUrl(
              selectedPeriod,
            ),
            {
              cache: "no-store",
              signal,
            },
          )

          const result =
            await readHistoryResponse(
              response,
            )

          const readings =
            Array.isArray(result.data)
              ? result.data
              : []

          setData(
            mapHistoryData(readings),
          )

          setLastUpdated(new Date())
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
            "Gagal mengambil data grafik:",
            historyError,
          )

          setError(
            historyError instanceof Error
              ? historyError.message
              : "Gagal mengambil data grafik",
          )
        } finally {
          setLoading(false)
        }
      },
      [],
    )

  const loadLatestReading =
    useCallback(async () => {
      if (
        latestRequestRunning.current
      ) {
        return
      }

      latestRequestRunning.current = true

      try {
        const response = await fetch(
          getLatestReadingUrl(),
          {
            cache: "no-store",
          },
        )

        const result =
          await readHistoryResponse(
            response,
          )

        const reading =
          result.data?.[0]

        if (!reading) {
          return
        }

        const mapped =
          mapHistoryReading(reading)

        if (!mapped) {
          return
        }

        setData(previousData => {
          const periodMilliseconds =
            periodConfigs[period].hours *
            60 *
            60 *
            1000

          const cutoff =
            Date.now() -
            periodMilliseconds

          const filtered =
            previousData.filter(
              item =>
                new Date(
                  item.time,
                ).getTime() >= cutoff,
            )

          const existingIndex =
            filtered.findIndex(
              item =>
                item.id === mapped.id,
            )

          if (existingIndex >= 0) {
            const nextData = [
              ...filtered,
            ]

            nextData[existingIndex] =
              mapped

            return nextData.sort(
              (first, second) =>
                new Date(
                  first.time,
                ).getTime() -
                new Date(
                  second.time,
                ).getTime(),
            )
          }

          return [
            ...filtered,
            mapped,
          ].sort(
            (first, second) =>
              new Date(
                first.time,
              ).getTime() -
              new Date(
                second.time,
              ).getTime(),
          )
        })

        setError(null)
        setLastUpdated(new Date())
      } catch (latestError) {
        console.error(
          "Gagal memperbarui grafik realtime:",
          latestError,
        )
      } finally {
        latestRequestRunning.current =
          false
      }
    }, [period])

  const manualRefresh =
    useCallback(async () => {
      setRefreshing(true)

      try {
        await loadHistory(period)
      } finally {
        setRefreshing(false)
      }
    }, [loadHistory, period])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const controller =
      new AbortController()

    void loadHistory(
      period,
      controller.signal,
    )

    return () => {
      controller.abort()
    }
  }, [loadHistory, period])

  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          void loadLatestReading()
        },
        refreshSeconds * 1000,
      )

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    loadLatestReading,
    refreshSeconds,
  ])

  const chartData = useMemo(
    () =>
      downsampleData(
        data,
        MAX_CHART_POINTS,
      ),
    [data],
  )

  const temperatureL4Stats =
    useMemo(
      () =>
        calculateMetricStats(
          data,
          "temperatureL4",
        ),
      [data],
    )

  const temperatureL5Stats =
    useMemo(
      () =>
        calculateMetricStats(
          data,
          "temperatureL5",
        ),
      [data],
    )

  const voltageStats =
    useMemo(
      () =>
        calculateMetricStats(
          data,
          "voltage",
        ),
      [data],
    )

  const currentStats =
    useMemo(
      () =>
        calculateMetricStats(
          data,
          "current",
        ),
      [data],
    )

  const selectedDate =
    data.length > 0
      ? formatFullDate(
          data[data.length - 1]
            .time,
        )
      : formatFullDate(new Date())

  const exportCsv = () => {
    if (data.length === 0) {
      return
    }

    const header = [
      "Waktu WIB",
      "Suhu Lantai 4 (C)",
      "Suhu Lantai 5 (C)",
      "Tegangan (V)",
      "Arus (A)",
    ].join(",")

    const rows = data.map(row =>
      [
        `"${formatCsvDateTime(
          row.time,
        )}"`,
        row.temperatureL4 ?? "",
        row.temperatureL5 ?? "",
        row.voltage ?? "",
        row.current ?? "",
      ].join(","),
    )

    const csv = [
      header,
      ...rows,
    ].join("\n")

    const blob = new Blob(
      [`\uFEFF${csv}`],
      {
        type: "text/csv;charset=utf-8",
      },
    )

    const url =
      URL.createObjectURL(blob)

    const link =
      document.createElement("a")

    link.href = url
    link.download =
      `grafik-monitoring-${
        periodConfigs[period]
          .fileLabel
      }.csv`

    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(url)
  }

  return (
    <AppShell
      title="Grafik Monitoring"
      description="Analisis suhu, tegangan, dan arus ruang server"
      actions={
        <Button
          type="button"
          onClick={exportCsv}
          variant="outline"
          disabled={
            loading ||
            data.length === 0
          }
        >
          <Download className="size-4" />

          <span className="hidden sm:inline">
            Export CSV
          </span>
        </Button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Thermometer}
          label="Suhu Lantai 4"
          value={getMetricValue(
            temperatureL4Stats.latest,
            1,
            "°C",
          )}
          description={
            temperatureL4Stats.hasData
              ? `Rata-rata ${getMetricValue(
                  temperatureL4Stats.average,
                  1,
                  "°C",
                )}`
              : "Belum ada data"
          }
          color="emerald"
          available={
            temperatureL4Stats.hasData
          }
        />

        <SummaryCard
          icon={Thermometer}
          label="Suhu Lantai 5"
          value={getMetricValue(
            temperatureL5Stats.latest,
            1,
            "°C",
          )}
          description="Sensor belum tersedia"
          color="blue"
          available={
            temperatureL5Stats.hasData
          }
        />

        <SummaryCard
          icon={Zap}
          label="Tegangan"
          value={getMetricValue(
            voltageStats.latest,
            1,
            " V",
          )}
          description="Sensor belum tersedia"
          color="amber"
          available={
            voltageStats.hasData
          }
        />

        <SummaryCard
          icon={Activity}
          label="Arus"
          value={getMetricValue(
            currentStats.latest,
            2,
            " A",
          )}
          description="Sensor belum tersedia"
          color="violet"
          available={
            currentStats.hasData
          }
        />
      </section>

      <Card className="mt-4 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarDays className="size-4 shrink-0" />

              <span>{selectedDate}</span>
            </div>

            <span className="text-xs text-slate-400">
              {lastUpdated
                ? `Pembaruan terakhir ${formatDateTime(
                    lastUpdated,
                  )}`
                : "Menunggu pembaruan data"}
            </span>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void manualRefresh()
              }}
              disabled={
                loading || refreshing
              }
              className="w-full sm:w-auto"
            >
              <RefreshCw
                className={`size-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              Perbarui
            </Button>

            <Tabs
              value={period}
              onValueChange={value =>
                setPeriod(
                  value as Period,
                )
              }
              className="w-full sm:w-auto"
            >
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-4">
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

                <TabsTrigger
                  value="168"
                  className="whitespace-nowrap rounded-lg px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  7 Hari
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mt-4 border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-rose-600" />

            <div>
              <p className="font-medium text-rose-700">
                Gagal memuat data grafik
              </p>

              <p className="mt-1 text-sm text-rose-600">
                {error}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <MetricChart
          data={chartData}
          period={period}
          dataKey="temperatureL4"
          title="Suhu Lantai 4"
          description={`Data realtime TEMP-L4 • ${
            periodConfigs[period]
              .label
          }`}
          unit="°C"
          decimals={1}
          stroke="#10b981"
          gradientId="temperature-l4-fill"
          warning={
            warningTemperature
          }
          danger={
            dangerTemperature
          }
          loading={loading}
          emptyMessage="Belum ada data suhu Lantai 4 pada periode ini."
        />

        <MetricChart
          data={chartData}
          period={period}
          dataKey="temperatureL5"
          title="Suhu Lantai 5"
          description="Sensor suhu Lantai 5 belum terpasang"
          unit="°C"
          decimals={1}
          stroke="#3b82f6"
          gradientId="temperature-l5-fill"
          loading={loading}
          emptyMessage="Data akan tampil setelah sensor suhu Lantai 5 terhubung."
        />

        <MetricChart
          data={chartData}
          period={period}
          dataKey="voltage"
          title="Tegangan"
          description="Sensor tegangan belum terpasang"
          unit=" V"
          decimals={1}
          stroke="#f59e0b"
          gradientId="voltage-fill"
          loading={loading}
          emptyMessage="Data akan tampil setelah sensor tegangan terhubung."
        />

        <MetricChart
          data={chartData}
          period={period}
          dataKey="current"
          title="Arus"
          description="Sensor arus belum terpasang"
          unit=" A"
          decimals={2}
          stroke="#8b5cf6"
          gradientId="current-fill"
          loading={loading}
          emptyMessage="Data akan tampil setelah sensor arus terhubung."
        />
      </section>
    </AppShell>
  )
}

function MetricChart({
  data,
  period,
  dataKey,
  title,
  description,
  unit,
  decimals,
  stroke,
  gradientId,
  warning,
  danger,
  loading = false,
  emptyMessage = "Belum ada data.",
}: MetricChartProps) {
  const stats = useMemo(
    () =>
      calculateMetricStats(
        data,
        dataKey,
      ),
    [data, dataKey],
  )

  const domain = useMemo(
    () =>
      calculateYAxisDomain(
        data,
        dataKey,
        warning,
        danger,
      ),
    [
      data,
      dataKey,
      warning,
      danger,
    ],
  )

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {title}
            </CardTitle>

            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          </div>

          {stats.hasData && (
            <div className="grid grid-cols-3 gap-3 text-left text-xs sm:text-right">
              <MetricInformation
                label="Minimum"
                value={getMetricValue(
                  stats.minimum,
                  decimals,
                  unit,
                )}
              />

              <MetricInformation
                label="Rata-rata"
                value={getMetricValue(
                  stats.average,
                  decimals,
                  unit,
                )}
              />

              <MetricInformation
                label="Maksimum"
                value={getMetricValue(
                  stats.maximum,
                  decimals,
                  unit,
                )}
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {loading ? (
          <div className="flex h-[330px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <LoaderCircle className="size-7 animate-spin" />

              <span className="text-sm">
                Memuat data grafik...
              </span>
            </div>
          </div>
        ) : !stats.hasData ? (
          <div className="flex h-[330px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
            <div className="max-w-xs px-6 text-center">
              <Activity className="mx-auto size-8 text-muted-foreground/30" />

              <p className="mt-3 text-sm font-medium text-muted-foreground">
                Belum ada data
              </p>

              <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
                {emptyMessage}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[330px] w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={data}
                margin={{
                  top: 22,
                  right: 18,
                  left: 0,
                  bottom: 8,
                }}
              >
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0"
                      stopColor={stroke}
                      stopOpacity={0.25}
                    />

                    <stop
                      offset="1"
                      stopColor={stroke}
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="#edf1ef"
                />

                <XAxis
                  dataKey="time"
                  tickFormatter={value =>
                    formatAxisTime(
                      String(value),
                      period,
                    )
                  }
                  axisLine={false}
                  tickLine={false}
                  minTickGap={42}
                  fontSize={11}
                />

                <YAxis
                  domain={domain}
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  width={55}
                  tickFormatter={value => {
                    const num = Number(value)
                    return dataKey === "current"
                      ? num.toFixed(decimals)
                      : num.toFixed(0)
                  }}
                />

                <Tooltip
                  labelFormatter={value =>
                    formatDateTime(
                      String(value),
                    )
                  }
                  formatter={value => [
                    `${Number(
                      value,
                    ).toFixed(
                      decimals,
                    )}${unit}`,
                    title,
                  ]}
                  contentStyle={{
                    borderRadius: 10,
                    border:
                      "1px solid #e2e8f0",
                  }}
                />

                {warning !== undefined && (
                  <ReferenceLine
                    y={warning}
                    stroke="#f59e0b"
                    strokeDasharray="6 4"
                    label={{
                      value:
                        `Waspada ${warning}°C`,
                      fill: "#d97706",
                      fontSize: 10,
                      position:
                        "insideTopLeft",
                    }}
                  />
                )}

                {danger !== undefined && (
                  <ReferenceLine
                    y={danger}
                    stroke="#f43f5e"
                    strokeDasharray="6 4"
                    label={{
                      value:
                        `Bahaya ${danger}°C`,
                      fill: "#f43f5e",
                      fontSize: 10,
                      position:
                        "insideTopLeft",
                    }}
                  />
                )}

                <Area
                  type="monotone"
                  dataKey={dataKey}
                  name={title}
                  stroke={stroke}
                  strokeWidth={2.4}
                  fill={`url(#${gradientId})`}
                  connectNulls={false}
                  isAnimationActive={false}
                  activeDot={{
                    r: 5,
                    fill: stroke,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MetricInformation({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <span>
      <small className="block text-slate-400">
        {label}
      </small>

      <strong className="whitespace-nowrap text-slate-700 dark:text-slate-200">
        {value}
      </strong>
    </span>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
  color,
  available = true,
}: SummaryCardProps) {
  const styles = {
    emerald:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    violet:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  }

  return (
    <Card
      className={
        available
          ? "border-border/60 bg-card"
          : "border-dashed border-border bg-muted/10"
      }
    >
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full ${styles[color]}`}
        >
          <Icon className="size-5" />
        </span>

        <span className="min-w-0">
          <small className="block truncate text-muted-foreground">
            {label}
          </small>

          <b className="block text-2xl font-bold tracking-tight">
            {value}
          </b>

          <span className="block truncate text-xs text-muted-foreground/80">
            {description}
          </span>
        </span>
      </CardContent>
    </Card>
  )
}