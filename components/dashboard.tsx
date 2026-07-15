"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { getSession, signOut } from "next-auth/react"
import {
  Activity, Bell, CalendarDays, CheckCircle2, ChevronDown, Clock3,
  Database, Menu, Radio, ShieldCheck, Thermometer, TrendingDown,
  TrendingUp, UserRound, Zap
} from "lucide-react"
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts"
import { AppSidebar } from "@/components/app-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { defaultMonitoringSettings, readMonitoringSettings, type MonitoringSettings } from "@/lib/monitoring-settings"

type RawReading = {
  id: number
  sensorId: string
  temperature: number
  voltage: number | null
  recordedAt: string
}

type Status = "Normal" | "Waspada" | "Bahaya"

const clock = (value: string, seconds = false) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined
  }).format(new Date(value))

const fullDate = (value: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(value)

export function Dashboard() {
  const [activeFloor, setActiveFloor] = useState<"4" | "5">("4") // Menu pilihan lantai (default 4)
  const [period, setPeriod] = useState("24") // default 24 jam terakhir
  const [rawReadings, setRawReadings] = useState<RawReading[]>([])
  const [now, setNow] = useState<Date | null>(null)
  const [settings, setSettings] = useState<MonitoringSettings>(defaultMonitoringSettings)
  const [loading, setLoading] = useState(true)

  // Load Settings dari API database
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings")
        const json = await res.json()
        if (json.success) {
          setSettings(json.data)
        }
      } catch (err) {
        console.error("Gagal mengambil pengaturan dari database:", err)
      }
    }
    fetchSettings()

    const changed = (event: Event) => setSettings((event as CustomEvent<MonitoringSettings>).detail)
    window.addEventListener("monitoring-settings-changed", changed)
    return () => {
      window.removeEventListener("monitoring-settings-changed", changed)
    }
  }, [])

  // Fetch Data dari API
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sensor/history?hours=${period}`,
      )

      const json = await res.json()

      if (json.success) {
        const readings: RawReading[] = (json.data ?? []).map(
          (reading: RawReading) => ({
            ...reading,
            temperature: Number(reading.temperature),
            voltage:
              reading.voltage !== null
                ? Number(reading.voltage)
                : null,
          }),
        )

        setRawReadings(readings)
      }
    } catch (err) {
      console.error("Gagal memuat data sensor:", err)
    } finally {
      setLoading(false)
    }
  }, [period])

  // Polling data sesuai interval pengaturan
  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, settings.refreshInterval * 1000)
    return () => clearInterval(timer)
  }, [fetchData, settings.refreshInterval])

  // Timer Jam Real-time
  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Pemilahan Data Terakhir per Sensor
  const readingL4 = rawReadings.find(r => r.sensorId === "TEMP-L4")
  const readingL5 = rawReadings.find(r => r.sensorId === "esp32-lantai5")

  // Cek Status Keaktifan Sensor
  const isOnline = (reading: RawReading | undefined) => {
    if (!reading || !now) return false
    const diffSeconds = (now.getTime() - new Date(reading.recordedAt).getTime()) / 1000
    return diffSeconds <= settings.offlineTimeout
  }

  const onlineL4 = isOnline(readingL4)
  const onlineL5 = isOnline(readingL5)

  // Status Suhu
  const getTempStatus = (temp: number | undefined): Status => {
    if (temp === undefined) return "Normal"
    if (temp >= settings.dangerTemperature) return "Bahaya"
    if (temp > settings.warningTemperature) return "Waspada"
    return "Normal"
  }

  const statusL4 = getTempStatus(readingL4?.temperature)
  const statusL5 = getTempStatus(readingL5?.temperature)

  const statusColor = (status: Status) =>
    status === "Normal" ? "text-emerald-600" : status === "Waspada" ? "text-amber-500" : "text-rose-600"

  const statusBg = (status: Status) =>
    status === "Normal" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : status === "Waspada" ? "bg-amber-50 text-amber-700 hover:bg-amber-50" : "bg-rose-50 text-rose-700 hover:bg-rose-50"

  // Filter Data Historis berdasarkan Lantai yang Aktif untuk Grafik
  const getChartData = () => {
    const targetId = activeFloor === "4" ? "TEMP-L4" : "esp32-lantai5"
    return rawReadings
      .filter(r => r.sensorId === targetId)
      .map(r => ({
        time: r.recordedAt,
        temperature: Number(r.temperature),
        voltage: r.voltage !== null ? Number(r.voltage) : null
      }))
      .reverse() // Urutkan dari terlama ke terbaru untuk Recharts
  }

  const chartData = getChartData()
  const recentReadings = rawReadings.slice(0, 5)

  // Hitung Nilai Rata-rata & Ekstrim Hari Ini (Sesuai Lantai Aktif)
  const activeSensorId =
    activeFloor === "4"
      ? "TEMP-L4"
      : "esp32-lantai5"

  const activeTemps = rawReadings
    .filter(
      reading =>
        reading.sensorId === activeSensorId,
    )
    .map(reading => Number(reading.temperature))
    .filter(temperature =>
      Number.isFinite(temperature),
    )

  const maxTemp =
    activeTemps.length > 0
      ? Math.max(...activeTemps)
      : null

  const minTemp =
    activeTemps.length > 0
      ? Math.min(...activeTemps)
      : null

  const avgTemp =
    activeTemps.length > 0
      ? activeTemps.reduce(
        (total, temperature) =>
          total + temperature,
        0,
      ) / activeTemps.length
      : null

  return (
    <div className="min-h-screen p-2 lg:flex bg-slate-50/50">
      <aside className="sticky top-2 hidden h-[calc(100vh-1rem)] w-56 shrink-0 overflow-hidden rounded-3xl border bg-white shadow-sm lg:block">
        <AppSidebar />
      </aside>

      <main className="min-w-0 flex-1 px-2 pb-6 lg:px-6">
        {/* Header */}
        <header className="flex min-h-20 items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="lg:hidden">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigasi</SheetTitle>
              <AppSidebar />
            </SheetContent>
          </Sheet>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl text-slate-800">Monitoring Dashboard</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 text-sm text-slate-500 xl:flex">
              <CalendarDays className="size-4" />
              {now ? `${fullDate(now)}, ${clock(now.toISOString(), true)} WIB` : "Memuat waktu..."}
            </span>
            <Button asChild variant="outline" className="border-red-100 bg-red-50 text-red-500">
              <Link href="/peringatan">
                <Bell />
                <span className="hidden sm:inline">Peringatan</span>
              </Link>
            </Button>
            <ProfilePanel />
          </div>
        </header>

        {/* Menu Pilihan Lantai (Tabs) */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <Tabs
            value={activeFloor}
            onValueChange={val => setActiveFloor(val as "4" | "5")}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-slate-100 p-1 rounded-xl">
              <TabsTrigger
                value="4"
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-[#005a9c] data-[state=active]:text-white"
              >
                Lantai 4 - Ruang Server
              </TabsTrigger>
              <TabsTrigger
                value="5"
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                Lantai 5 - Ruangan ATC
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={period} onValueChange={setPeriod} className="w-full sm:w-auto">
            <TabsList>
              {[1, 6, 24].map(x => (
                <TabsTrigger key={x} value={`${x}`}>
                  {x} Jam Terakhir
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">
            Menghubungkan ke database Supabase...
          </div>
        ) : (
          <>
            {/* Bagian Tampilan Kategori Lantai 4 */}
            {activeFloor === "4" && (
              <div>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    icon={Thermometer}
                    label="Suhu Ruang Server"
                    value={readingL4 ? `${Number(readingL4.temperature)}°C` : "--°C"}
                    detail={`Status: ${statusL4}`}
                    valueClassName={statusColor(statusL4)}
                    iconColor="bg-emerald-50 text-[#005a9c]"
                  />
                  <Metric
                    icon={Zap}
                    label="Tegangan Server AC"
                    value={readingL4?.voltage !== null && readingL4?.voltage !== undefined ? `${Number(readingL4.voltage).toFixed(1)} V` : "-- V"}
                    detail={readingL4?.voltage ? (readingL4.voltage >= 200 && readingL4.voltage <= 240 ? "Normal (Stabil)" : "Tegangan Tidak Stabil") : "Tidak ada data"}
                    valueClassName={readingL4?.voltage ? (readingL4.voltage >= 200 && readingL4.voltage <= 240 ? "text-emerald-600" : "text-rose-600") : "text-slate-400"}
                    iconColor="bg-amber-50 text-amber-500"
                  />
                  <Metric
                    icon={Radio}
                    label="Status Sensor L4"
                    value={onlineL4 ? "Online" : "Offline"}
                    detail={readingL4 ? `Update: ${clock(readingL4.recordedAt, true)}` : "Belum ada data"}
                    valueClassName={onlineL4 ? "text-emerald-600" : "text-rose-600"}
                    iconColor="bg-blue-50 text-blue-500"
                  />
                  <Metric
                    icon={ShieldCheck}
                    label="Kondisi Ruangan L4"
                    value={statusL4 === "Bahaya" ? "BAHAYA" : statusL4 === "Waspada" ? "PERHATIAN" : "AMAN"}
                    detail={statusL4 === "Normal" ? "Suhu & Tegangan aman" : "Segera periksa AC server!"}
                    valueClassName={statusColor(statusL4)}
                    iconColor="bg-slate-50 text-slate-700"
                  />
                </section>

                {/* Grafik Terpisah untuk Lantai 4 */}
                <section className="mt-6 grid gap-6 xl:grid-cols-2">
                  {/* Grafik Suhu Lantai 4 */}
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-semibold text-slate-700">Grafik Tren Suhu Lantai 4</CardTitle>
                      <p className="text-[11px] text-slate-400">Suhu (°C) Ruang Server</p>
                    </CardHeader>
                    <CardContent className="h-72 pl-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="tempL4Grad" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0" stopColor="#10b981" stopOpacity={0.2} />
                              <stop offset="1" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="#edf1ef" />
                          <XAxis
                            dataKey="time"
                            tickFormatter={v => clock(v)}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={45}
                            fontSize={11}
                          />
                          <YAxis
                            domain={[18, 36]}
                            ticks={[18, 21, 24, 27, 30, 33, 36]}
                            axisLine={false}
                            tickLine={false}
                            fontSize={11}
                          />
                          <Tooltip
                            labelFormatter={v => clock(String(v), true)}
                            formatter={v => [`${Number(v)}°C`, "Suhu"]}
                          />
                          <ReferenceLine
                            y={settings.dangerTemperature}
                            stroke="#fb7185"
                            strokeDasharray="5 4"
                            label={{
                              value: `Bahaya (≥${settings.dangerTemperature}°C)`,
                              fill: "#f43f5e",
                              fontSize: 10,
                              position: "insideTopLeft"
                            }}
                          />
                          <ReferenceLine
                            y={settings.warningTemperature}
                            stroke="#f59e0b"
                            strokeDasharray="5 4"
                            label={{
                              value: `Waspada (${settings.warningTemperature}°C)`,
                              fill: "#d97706",
                              fontSize: 10,
                              position: "insideTopLeft"
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="temperature"
                            stroke="#10b981"
                            strokeWidth={2.4}
                            fill="url(#tempL4Grad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Grafik Tegangan Lantai 4 */}
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-semibold text-slate-700">Grafik Tegangan AC Lantai 4</CardTitle>
                      <p className="text-[11px] text-slate-400">Tegangan Listrik (Volt)</p>
                    </CardHeader>
                    <CardContent className="h-72 pl-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="voltL4Grad" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0" stopColor="#d97706" stopOpacity={0.15} />
                              <stop offset="1" stopColor="#d97706" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="#edf1ef" />
                          <XAxis
                            dataKey="time"
                            tickFormatter={v => clock(v)}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={45}
                            fontSize={11}
                          />
                          <YAxis
                            domain={[180, 260]}
                            ticks={[180, 200, 220, 240, 260]}
                            axisLine={false}
                            tickLine={false}
                            fontSize={11}
                          />
                          <Tooltip
                            labelFormatter={v => clock(String(v), true)}
                            formatter={v => [v !== null ? `${Number(v).toFixed(1)} V` : "-- V", "Tegangan"]}
                          />
                          <ReferenceLine
                            y={220}
                            stroke="#3b82f6"
                            strokeDasharray="4 4"
                            label={{
                              value: "PLN Target (220V)",
                              fill: "#2563eb",
                              fontSize: 10,
                              position: "insideTopLeft"
                            }}
                          />
                          <ReferenceLine
                            y={200}
                            stroke="#f43f5e"
                            strokeDasharray="4 4"
                            label={{
                              value: "Batas Bawah (200V)",
                              fill: "#e11d48",
                              fontSize: 10,
                              position: "insideBottomLeft"
                            }}
                          />
                          <ReferenceLine
                            y={240}
                            stroke="#f43f5e"
                            strokeDasharray="4 4"
                            label={{
                              value: "Batas Atas (240V)",
                              fill: "#e11d48",
                              fontSize: 10,
                              position: "insideTopLeft"
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="voltage"
                            stroke="#d97706"
                            strokeWidth={2.4}
                            fill="url(#voltL4Grad)"
                            connectNulls
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </section>
              </div>
            )}

            {/* Bagian Tampilan Kategori Lantai 5 */}
            {activeFloor === "5" && (
              <div>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Metric
                    icon={Thermometer}
                    label="Suhu Ruangan L5"
                    value={readingL5 ? `${Number(readingL5.temperature)}°C` : "--°C"}
                    detail={`Status: ${statusL5}`}
                    valueClassName={statusColor(statusL5)}
                    iconColor="bg-purple-50 text-purple-600"
                  />
                  <Metric
                    icon={Radio}
                    label="Status Sensor L5"
                    value={onlineL5 ? "Online" : "Offline"}
                    detail={readingL5 ? `Update: ${clock(readingL5.recordedAt, true)}` : "Belum ada data"}
                    valueClassName={onlineL5 ? "text-emerald-600" : "text-rose-600"}
                    iconColor="bg-blue-50 text-blue-500"
                  />
                  <Metric
                    icon={ShieldCheck}
                    label="Kondisi Ruangan L5"
                    value={statusL5 === "Bahaya" ? "BAHAYA" : statusL5 === "Waspada" ? "PERHATIAN" : "AMAN"}
                    detail={statusL5 === "Normal" ? "Suhu ruangan normal" : "Periksa kondisi AC Lantai 5!"}
                    valueClassName={statusColor(statusL5)}
                    iconColor="bg-slate-50 text-slate-700"
                  />
                </section>

                {/* Grafik Tunggal untuk Lantai 5 */}
                <section className="mt-6">
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-md font-semibold text-slate-700">Grafik Tren Suhu Lantai 5</CardTitle>
                      <p className="text-[11px] text-slate-400">Suhu (°C) Ruang Kerja</p>
                    </CardHeader>
                    <CardContent className="h-80 pl-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="tempL5Grad" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0" stopColor="#8b5cf6" stopOpacity={0.2} />
                              <stop offset="1" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="#edf1ef" />
                          <XAxis
                            dataKey="time"
                            tickFormatter={v => clock(v)}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={45}
                            fontSize={11}
                          />
                          <YAxis
                            domain={[18, 36]}
                            ticks={[18, 21, 24, 27, 30, 33, 36]}
                            axisLine={false}
                            tickLine={false}
                            fontSize={11}
                          />
                          <Tooltip
                            labelFormatter={v => clock(String(v), true)}
                            formatter={v => [`${Number(v)}°C`, "Suhu"]}
                          />
                          <ReferenceLine
                            y={settings.dangerTemperature}
                            stroke="#fb7185"
                            strokeDasharray="5 4"
                            label={{
                              value: `Bahaya (≥${settings.dangerTemperature}°C)`,
                              fill: "#f43f5e",
                              fontSize: 10,
                              position: "insideTopLeft"
                            }}
                          />
                          <ReferenceLine
                            y={settings.warningTemperature}
                            stroke="#f59e0b"
                            strokeDasharray="5 4"
                            label={{
                              value: `Waspada (${settings.warningTemperature}°C)`,
                              fill: "#d97706",
                              fontSize: 10,
                              position: "insideTopLeft"
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="temperature"
                            stroke="#8b5cf6"
                            strokeWidth={2.4}
                            fill="url(#tempL5Grad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </section>
              </div>
            )}

            {/* Bagian Bawah: Batas Alarm, Status Koneksi, & Tabel Log */}
            <section className="mt-6 grid gap-6 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Ambang Batas Suhu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Limit color="bg-emerald-500" label="Normal" value={`≤ ${Number(settings.warningTemperature)}°C`} />
                  <Limit color="bg-amber-400" label="Waspada" value={`${Number(settings.warningTemperature)}–${Number(settings.dangerTemperature)}°C`} />
                  <Limit color="bg-rose-500" label="Bahaya" value={`≥ ${Number(settings.dangerTemperature)}°C`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Status Koneksi Sistem</CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  <SystemRow icon={CheckCircle2} label="Dashboard Vercel" />
                  <SystemRow icon={Database} label="Postgres Supabase" />
                  <SystemRow icon={Radio} label="Sensor L4 (Server)" online={onlineL4} />
                  <SystemRow icon={Radio} label="Sensor L5 (Ruangan)" online={onlineL5} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Ringkasan {period} Jam Terakhir (
                    {activeFloor === "4" ? "Lantai 4" : "Lantai 5"})
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  <SummaryRow
                    icon={TrendingUp}
                    label="Suhu Tertinggi"
                    value={
                      maxTemp !== null
                        ? `${maxTemp.toFixed(2)}°C`
                        : "--°C"
                    }
                    color="bg-rose-50 text-rose-500"
                  />

                  <SummaryRow
                    icon={TrendingDown}
                    label="Suhu Terendah"
                    value={
                      minTemp !== null
                        ? `${minTemp.toFixed(2)}°C`
                        : "--°C"
                    }
                    color="bg-blue-50 text-blue-500"
                  />

                  <SummaryRow
                    icon={Activity}
                    label="Rata-rata Suhu"
                    value={
                      avgTemp !== null
                        ? `${avgTemp.toFixed(2)}°C`
                        : "--°C"
                    }
                    color="bg-emerald-50 text-emerald-600"
                  />
                </CardContent>
              </Card>
            </section>

            {/* Riwayat Terbaru */}
            <section className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">5 Pembacaan Terakhir (Semua Lantai)</CardTitle>
                  <Link href="/riwayat" className="text-xs font-semibold text-emerald-600 hover:underline">
                    Lihat Semua Riwayat
                  </Link>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Waktu</TableHead>
                        <TableHead>Identitas Sensor</TableHead>
                        <TableHead>Suhu (°C)</TableHead>
                        <TableHead>Tegangan (V)</TableHead>
                        <TableHead className="pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentReadings.length ? (
                        recentReadings.map(row => {
                          const status = getTempStatus(row.temperature)
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="pl-6">{clock(row.recordedAt, true)}</TableCell>
                              <TableCell>
                                <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono font-medium">
                                  {row.sensorId === "TEMP-L4" ? "Lantai 4 (Server)" : "Lantai 5 (Ruang Kerja)"}
                                </code>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-800">{Number(row.temperature)}°C</TableCell>
                              <TableCell className="text-slate-600">{row.voltage !== null ? `${Number(row.voltage).toFixed(1)} V` : "-- V"}</TableCell>
                              <TableCell className="pr-6">
                                <Badge variant="secondary" className={statusBg(status)}>
                                  ● {status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-20 text-center text-slate-400">
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
      </main>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail, valueClassName = "text-emerald-600", iconColor = "bg-emerald-50 text-[#005a9c]" }: { icon: any, label: string, value: string, detail: string, valueClassName?: string, iconColor?: string }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="flex min-h-32 items-center gap-4 p-5">
        <div className={`grid size-14 shrink-0 place-items-center rounded-full ${iconColor}`}>
          <Icon className="size-7" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-semibold">{label}</p>
          <p className={`truncate text-2xl font-bold ${valueClassName}`}>{value}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{detail}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Limit({ color, label, value }: { color: string, label: string, value: string }) {
  return (
    <div className="flex items-center rounded-xl border px-3 py-3 text-xs font-semibold">
      <span className={`mr-3 size-2 rounded-full ${color}`} />
      <span className="text-slate-500">{label}</span>
      <b className="ml-auto text-slate-700">{value}</b>
    </div>
  )
}

function SummaryRow({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <span className={`grid size-11 place-items-center rounded-full ${color}`}>
        <Icon className="size-5" />
      </span>
      <span>
        <small className="text-slate-500 block text-[11px] leading-tight font-medium">{label}</small>
        <b className="block text-md font-bold text-slate-800">{value}</b>
      </span>
    </div>
  )
}

function SystemRow({ icon: Icon, label, online = true }: { icon: any, label: string, online?: boolean }) {
  return (
    <div className="flex items-center py-3 text-xs font-semibold">
      <Icon className={`mr-2 size-4 ${online ? "text-emerald-600" : "text-rose-600"}`} />
      <span className="text-slate-500">{label}</span>
      <span className={`ml-auto ${online ? "text-emerald-600" : "text-rose-600"}`}>
        {online ? "Online" : "Offline"}
      </span>
    </div>
  )
}

function ProfilePanel() {
  const [profile, setProfile] = useState<{ name?: string | null; email?: string | null; role?: string } | null>(null)

  useEffect(() => {
    getSession().then(session => setProfile(session?.user ?? null))
  }, [])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserRound />
          <span className="hidden sm:inline">{profile?.name ?? "Pengguna"}</span>
          <ChevronDown className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle>Profil Pengguna</SheetTitle>
        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
          <div className="grid size-12 place-items-center rounded-full bg-[#005a9c] text-white">
            <UserRound />
          </div>
          <div className="min-w-0">
            <b className="block truncate text-slate-800">{profile?.name ?? "Memuat..."}</b>
            <span className="block truncate text-xs text-slate-500">{profile?.email}</span>
            <Badge className="mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {profile?.role ?? "-"}
            </Badge>
          </div>
        </div>
        <nav className="mt-6 space-y-2">
          {profile?.role === "ADMIN" && (
            <Button asChild variant="ghost" className="w-full justify-start text-slate-600">
              <Link href="/pengaturan">Pengaturan sistem</Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="w-full justify-start text-slate-600">
            <Link href="/riwayat">Riwayat monitoring</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start text-slate-600">
            <Link href="/peringatan">Pusat peringatan</Link>
          </Button>
          <Button
            variant="outline"
            className="mt-4 w-full text-rose-600 border-rose-200 hover:bg-rose-50"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Keluar
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
