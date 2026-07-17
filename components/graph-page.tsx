"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Download,
  Thermometer,
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

const configs: Record<
  Period,
  {
    points: number
    step: number
    label: string
  }
> = {
  "1": {
    points: 61,
    step: 60_000,
    label: "1 Jam",
  },
  "6": {
    points: 73,
    step: 5 * 60_000,
    label: "6 Jam",
  },
  "24": {
    points: 97,
    step: 15 * 60_000,
    label: "24 Jam",
  },
  "168": {
    points: 85,
    step: 2 * 60 * 60_000,
    label: "7 Hari",
  },
}

const formatTime = (
  value: string,
  period: Period,
) =>
  new Intl.DateTimeFormat(
    "id-ID",
    period === "168"
      ? {
          timeZone: "Asia/Jakarta",
          weekday: "short",
          hour: "2-digit",
        }
      : {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
        },
  ).format(new Date(value))

export function GraphPage() {
  const [period, setPeriod] =
    useState<Period>("24")

  const data = useMemo(() => {
    const { points, step } = configs[period]
    const end = Date.UTC(2025, 4, 10, 7, 32)

    return Array.from(
      { length: points },
      (_, i) => ({
        time: new Date(
          end -
            (points - 1 - i) *
              step,
        ).toISOString(),

        temperature: +(
          26.15 +
          Math.sin(i / 5) * 0.75 +
          Math.sin(i / 2.3) * 0.25 +
          (i % 19 === 0 ? 1.2 : 0)
        ).toFixed(1),
      }),
    )
  }, [period])

  const values = data.map(
    item => item.temperature,
  )

  const max = Math.max(...values)
  const min = Math.min(...values)

  const average =
    values.reduce(
      (total, value) =>
        total + value,
      0,
    ) / values.length

  const exportCsv = () => {
    const csv =
      "Waktu,Suhu (C)\n" +
      data
        .map(
          row =>
            `${row.time},${row.temperature}`,
        )
        .join("\n")

    const url = URL.createObjectURL(
      new Blob([csv], {
        type: "text/csv;charset=utf-8",
      }),
    )

    const link =
      document.createElement("a")

    link.href = url
    link.download = `grafik-suhu-${period}-jam.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <AppShell
      title="Grafik Suhu"
      description="Analisis tren suhu ruang server"
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
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={ArrowUp}
          label="Suhu Tertinggi"
          value={`${max.toFixed(1)}°C`}
          color="rose"
        />

        <Stat
          icon={ArrowDown}
          label="Suhu Terendah"
          value={`${min.toFixed(1)}°C`}
          color="blue"
        />

        <Stat
          icon={Activity}
          label="Rata-rata"
          value={`${average.toFixed(1)}°C`}
          color="green"
        />
      </section>

      <Card className="mt-4 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              Riwayat Suhu
            </CardTitle>

            <p className="mt-1 text-sm text-slate-500">
              Periode{" "}
              {configs[period].label}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
            >
              <CalendarDays className="size-4" />
              10 Mei 2025
            </Button>

            <Tabs
              value={period}
              onValueChange={value =>
                setPeriod(
                  value as Period,
                )
              }
            >
              <TabsList>
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
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-[460px] w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={data}
                margin={{
                  top: 24,
                  right: 20,
                  left: -5,
                  bottom: 8,
                }}
              >
                <defs>
                  <linearGradient
                    id="graph-fill"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0"
                      stopColor="#10b981"
                      stopOpacity={0.28}
                    />

                    <stop
                      offset="1"
                      stopColor="#10b981"
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
                    formatTime(
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
                  domain={[22, 32]}
                  ticks={[
                    22,
                    24,
                    26,
                    27,
                    28,
                    30,
                    32,
                  ]}
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  unit="°"
                />

                <Tooltip
                  labelFormatter={value =>
                    new Intl.DateTimeFormat(
                      "id-ID",
                      {
                        timeZone:
                          "Asia/Jakarta",
                        dateStyle:
                          "medium",
                        timeStyle:
                          "medium",
                      },
                    ).format(
                      new Date(
                        String(value),
                      ),
                    )
                  }
                  formatter={value => [
                    `${Number(
                      value,
                    ).toFixed(1)}°C`,
                    "Suhu",
                  ]}
                />

                <ReferenceLine
                  y={30}
                  stroke="#f43f5e"
                  strokeDasharray="6 4"
                  label={{
                    value:
                      "Bahaya 30°C",
                    fill: "#f43f5e",
                    fontSize: 11,
                    position:
                      "insideTopLeft",
                  }}
                />

                <ReferenceLine
                  y={27}
                  stroke="#f59e0b"
                  strokeDasharray="6 4"
                  label={{
                    value:
                      "Waspada 27°C",
                    fill: "#d97706",
                    fontSize: 11,
                    position:
                      "insideTopLeft",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="temperature"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#graph-fill)"
                  activeDot={{
                    r: 5,
                    fill: "#059669",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Thermometer
  label: string
  value: string
  color:
    | "rose"
    | "blue"
    | "green"
}) {
  const styles = {
    rose: "bg-rose-50 text-rose-500",
    blue: "bg-blue-50 text-blue-500",
    green:
      "bg-emerald-50 text-emerald-600",
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={`grid size-12 place-items-center rounded-full ${styles[color]}`}
        >
          <Icon className="size-5" />
        </span>

        <span>
          <small className="text-slate-500">
            {label}
          </small>

          <b className="block text-2xl">
            {value}
          </b>
        </span>
      </CardContent>
    </Card>
  )
}