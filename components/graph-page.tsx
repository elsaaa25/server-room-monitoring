"use client"

import {
  useMemo,
  useState,
  type ComponentType,
} from "react"
import {
  Activity,
  CalendarDays,
  Download,
  Gauge,
  Thermometer,
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

type GraphPoint = {
  time: string
  temperatureL4: number
  temperatureL5: number
  voltage: number
  current: number
}

type MetricKey =
  | "temperatureL4"
  | "temperatureL5"
  | "voltage"
  | "current"

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
}

const WARNING_TEMPERATURE = 27
const DANGER_TEMPERATURE = 30

const periodConfigs: Record<
  Period,
  {
    points: number
    step: number
    label: string
    fileLabel: string
  }
> = {
  "1": {
    points: 61,
    step: 60_000,
    label: "1 Jam",
    fileLabel: "1-jam",
  },
  "6": {
    points: 73,
    step: 5 * 60_000,
    label: "6 Jam",
    fileLabel: "6-jam",
  },
  "24": {
    points: 97,
    step: 15 * 60_000,
    label: "24 Jam",
    fileLabel: "24-jam",
  },
  "168": {
    points: 85,
    step: 2 * 60 * 60_000,
    label: "7 Hari",
    fileLabel: "7-hari",
  },
}

function formatAxisTime(
  value: string,
  period: Period,
): string {
  const date = new Date(value)

  if (period === "168") {
    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        weekday: "short",
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
  return new Intl.DateTimeFormat(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(new Date(value))
}

function formatTooltipDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "medium",
    },
  ).format(new Date(value))
}

function calculateMetricStats(
  data: GraphPoint[],
  key: MetricKey,
) {
  const values = data
    .map(item => Number(item[key]))
    .filter(Number.isFinite)

  if (values.length === 0) {
    return {
      latest: 0,
      minimum: 0,
      maximum: 0,
      average: 0,
    }
  }

  const latest =
    values[values.length - 1]

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

  const average =
    values.reduce(
      (total, value) =>
        total + value,
      0,
    ) / values.length

  return {
    latest,
    minimum,
    maximum,
    average,
  }
}

function calculateYAxisDomain(
  data: GraphPoint[],
  key: MetricKey,
  warning?: number,
  danger?: number,
): [number, number] {
  const values = data
    .map(item => Number(item[key]))
    .filter(Number.isFinite)

  if (warning !== undefined) {
    values.push(warning)
  }

  if (danger !== undefined) {
    values.push(danger)
  }

  if (values.length === 0) {
    return [0, 10]
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

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

  return [
    Number(
      (minimum - padding).toFixed(2),
    ),
    Number(
      (maximum + padding).toFixed(2),
    ),
  ]
}

/**
 * Data di bawah masih berupa simulasi.
 * Nantinya fungsi ini diganti dengan data
 * dari API sensor_readings.
 */
function createSimulationData(
  period: Period,
): GraphPoint[] {
  const { points, step } =
    periodConfigs[period]

  const end = Date.now()

  return Array.from(
    {
      length: points,
    },
    (_, index) => {
      const time =
        end -
        (points - 1 - index) * step

      const temperatureL4 =
        23.5 +
        Math.sin(index / 5) * 0.8 +
        Math.sin(index / 2.4) * 0.25 +
        (index % 29 === 0 ? 0.9 : 0)

      const temperatureL5 =
        24.1 +
        Math.sin(index / 6) * 0.7 +
        Math.cos(index / 3.2) * 0.2 +
        (index % 31 === 0 ? 0.7 : 0)

      const voltage =
        220 +
        Math.sin(index / 4.5) * 1.4 +
        Math.cos(index / 8) * 0.6

      const current =
        1.85 +
        Math.sin(index / 4) * 0.22 +
        Math.cos(index / 7) * 0.08

      return {
        time: new Date(time).toISOString(),

        temperatureL4: Number(
          temperatureL4.toFixed(2),
        ),

        temperatureL5: Number(
          temperatureL5.toFixed(2),
        ),

        voltage: Number(
          voltage.toFixed(2),
        ),

        current: Number(
          current.toFixed(2),
        ),
      }
    },
  )
}

export function GraphPage() {
  const [period, setPeriod] =
    useState<Period>("24")

  const data = useMemo(
    () => createSimulationData(period),
    [period],
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
          data[data.length - 1].time,
        )
      : "-"

  const exportCsv = () => {
    const header = [
      "Waktu",
      "Suhu Lantai 4 (C)",
      "Suhu Lantai 5 (C)",
      "Tegangan (V)",
      "Arus (A)",
    ].join(",")

    const rows = data.map(row =>
      [
        row.time,
        row.temperatureL4,
        row.temperatureL5,
        row.voltage,
        row.current,
      ].join(","),
    )

    const csv = [
      header,
      ...rows,
    ].join("\n")

    const blob = new Blob(
      [csv],
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
        periodConfigs[period].fileLabel
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
          value={`${temperatureL4Stats.latest.toFixed(
            1,
          )}°C`}
          description={`Rata-rata ${temperatureL4Stats.average.toFixed(
            1,
          )}°C`}
          color="emerald"
        />

        <SummaryCard
          icon={Thermometer}
          label="Suhu Lantai 5"
          value={`${temperatureL5Stats.latest.toFixed(
            1,
          )}°C`}
          description={`Rata-rata ${temperatureL5Stats.average.toFixed(
            1,
          )}°C`}
          color="blue"
        />

        <SummaryCard
          icon={Zap}
          label="Tegangan"
          value={`${voltageStats.latest.toFixed(
            1,
          )} V`}
          description={`Rata-rata ${voltageStats.average.toFixed(
            1,
          )} V`}
          color="amber"
        />

        <SummaryCard
          icon={Activity}
          label="Arus"
          value={`${currentStats.latest.toFixed(
            2,
          )} A`}
          description={`Rata-rata ${currentStats.average.toFixed(
            2,
          )} A`}
          color="violet"
        />
      </section>

      <Card className="mt-4 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="size-4" />

            <span>{selectedDate}</span>
          </div>

          <Tabs
            value={period}
            onValueChange={value =>
              setPeriod(value as Period)
            }
          >
            <TabsList className="w-full overflow-x-auto sm:w-auto">
              <TabsTrigger value="1">
                1 Jam
              </TabsTrigger>

              <TabsTrigger value="6">
                6 Jam
              </TabsTrigger>

              <TabsTrigger value="24">
                24 Jam
              </TabsTrigger>

              <TabsTrigger value="168">
                7 Hari
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <MetricChart
          data={data}
          period={period}
          dataKey="temperatureL4"
          title="Suhu Lantai 4"
          description={`Periode ${
            periodConfigs[period].label
          }`}
          unit="°C"
          decimals={1}
          stroke="#10b981"
          gradientId="temperature-l4-fill"
          warning={WARNING_TEMPERATURE}
          danger={DANGER_TEMPERATURE}
        />

        <MetricChart
          data={data}
          period={period}
          dataKey="temperatureL5"
          title="Suhu Lantai 5"
          description={`Periode ${
            periodConfigs[period].label
          }`}
          unit="°C"
          decimals={1}
          stroke="#3b82f6"
          gradientId="temperature-l5-fill"
          warning={WARNING_TEMPERATURE}
          danger={DANGER_TEMPERATURE}
        />

        <MetricChart
          data={data}
          period={period}
          dataKey="voltage"
          title="Tegangan"
          description={`Periode ${
            periodConfigs[period].label
          }`}
          unit=" V"
          decimals={1}
          stroke="#f59e0b"
          gradientId="voltage-fill"
        />

        <MetricChart
          data={data}
          period={period}
          dataKey="current"
          title="Arus"
          description={`Periode ${
            periodConfigs[period].label
          }`}
          unit=" A"
          decimals={2}
          stroke="#8b5cf6"
          gradientId="current-fill"
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
    <Card className="shadow-sm">
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

          <div className="grid grid-cols-3 gap-3 text-right text-xs">
            <MetricInformation
              label="Min"
              value={`${stats.minimum.toFixed(
                decimals,
              )}${unit}`}
            />

            <MetricInformation
              label="Rata-rata"
              value={`${stats.average.toFixed(
                decimals,
              )}${unit}`}
            />

            <MetricInformation
              label="Maks"
              value={`${stats.maximum.toFixed(
                decimals,
              )}${unit}`}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[330px] w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart
              data={data}
              margin={{
                top: 20,
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
                width={52}
                tickFormatter={value =>
                  Number(value).toFixed(
                    decimals,
                  )
                }
              />

              <Tooltip
                labelFormatter={value =>
                  formatTooltipDate(
                    String(value),
                  )
                }
                formatter={value => [
                  `${Number(value).toFixed(
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
                    value: `Waspada ${warning}°C`,
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
                    value: `Bahaya ${danger}°C`,
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
                activeDot={{
                  r: 5,
                  fill: stroke,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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

      <strong className="whitespace-nowrap text-slate-700">
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
}: SummaryCardProps) {
  const styles = {
    emerald:
      "bg-emerald-50 text-emerald-600",
    blue:
      "bg-blue-50 text-blue-600",
    amber:
      "bg-amber-50 text-amber-600",
    violet:
      "bg-violet-50 text-violet-600",
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full ${styles[color]}`}
        >
          <Icon className="size-5" />
        </span>

        <span className="min-w-0">
          <small className="block truncate text-slate-500">
            {label}
          </small>

          <b className="block text-2xl">
            {value}
          </b>

          <span className="block truncate text-xs text-slate-400">
            {description}
          </span>
        </span>
      </CardContent>
    </Card>
  )
}