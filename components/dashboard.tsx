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
  Tooltip, XAxis, YAxis, Legend 
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

type ChartDataPoint = {
  time: string
  tempL4?: number
  tempL5?: number
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
  const [period, setPeriod] = useState("24") // default 24 jam terakhir
  const [rawReadings, setRawReadings] = useState<RawReading[]>([])
  const [now, setNow] = useState<Date | null>(null)
  const [settings, setSettings] = useState<MonitoringSettings>(defaultMonitoringSettings)
  const [loading, setLoading] = useState(true)

  // Load Settings
  useEffect(() => {
    const load = () => setSettings(readMonitoringSettings())
    const changed = (event: Event) => setSettings((event as CustomEvent<MonitoringSettings>).detail)
    load()
    window.addEventListener("storage", load)
    window.addEventListener("monitoring-settings-changed", changed)
    return () => {
      window.removeEventListener("storage", load)
      window.removeEventListener("monitoring-settings-changed", changed)
    }
  }, [])

  // Fetch Data dari API
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sensor/history?hours=${period}`)
      const json = await res.json()
      if (json.success) {
        setRawReadings(json.data)
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
  const readingL4 = rawReadings.find(r => r.sensorId === "esp32-lantai4")
  const readingL5 = rawReadings.find(r => r.sensorId === "esp32-lantai5")

  // Cek Status Keaktifan Sensor (Online jika update terakhir < offlineTimeout)
  const isOnline = (reading: RawReading | undefined) => {
    if (!reading || !now) return false
    const diffSeconds = (now.getTime() - new Date(reading.recordedAt).getTime()) / 1000
    return diffSeconds <= settings.offlineTimeout
  }

  const onlineL4 = isOnline(readingL4)
  const onlineL5 = isOnline(readingL5)

  // Status Suhu (Mengikuti threshold pengaturan)
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
    status === "Normal" ? "bg-emerald-50 text-emerald-700" : status === "Waspada" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"

  // Menggabungkan data historis untuk grafik Recharts (dikelompokkan per 5 menit)
  const getMergedChartData = (): ChartDataPoint[] => {
    const merged: { [key: string]: ChartDataPoint } = {}
    
    rawReadings.forEach(r => {
      // Bulatkan waktu ke 5 menit terdekat agar grafik sejajar
      const date = new Date(r.recordedAt)
      const minutes = Math.round(date.getMinutes() / 5) * 5
      date.setMinutes(minutes)
      date.setSeconds(0)
      date.setMilliseconds(0)
      const timeKey = date.toISOString()

      if (!merged[timeKey]) {
        merged[timeKey] = { time: timeKey }
      }

      if (r.sensorId === "esp32-lantai4") {
        merged[timeKey].tempL4 = Number(r.temperature)
      } else if (r.sensorId === "esp32-lantai5") {
        merged[timeKey].tempL5 = Number(r.temperature)
      }
    })

    // Kembalikan array terurut dari terlama ke terbaru untuk grafik
    return Object.values(merged)
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  const chartData = getMergedChartData()
  const recentReadings = rawReadings.slice(0, 5)

  // Hitung Nilai Rata-rata & Ekstrim Hari Ini
  const tempsL4 = rawReadings.filter(r => r.sensorId === "esp32-lantai4").map(r => r.temperature)
  const maxTempL4 = tempsL4.length ? Math.max(...tempsL4) : 0
  const minTempL4 = tempsL4.length ? Math.min(...tempsL4) : 0
  const avgTempL4 = tempsL4.length ? tempsL4.reduce((a, b) => a + b, 0) / tempsL4.length : 0

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
            <h1 className="text-xl font-semibold sm:text-2xl text-slate-800">Server Room Monitoring</h1>
            <p className="hidden sm:block text-xs text-slate-500">Pemantauan real-time Suhu (Lantai 4 & 5) & Tegangan (Lantai 4)</p>
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

        {/* Dashboard Grid Utama */}
        {loading ? (
          <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">
            Menghubungkan ke database Supabase...
          </div>
        ) : (
          <>
            {/* Bagian Lantai 4 (Ruang Server) */}
            <div className="mb-6">
              <h2 className="text-md font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#005a9c]" /> Lantai 4 - Ruang Server
              </h2>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric 
                  icon={Thermometer} 
                  label="Suhu Ruang Server" 
                  value={readingL4 ? `${Number(readingL4.temperature).toFixed(1)}°C` : "--°C"} 
                  detail={`Status: ${statusL4}`}
                  valueClassName={statusColor(statusL4)}
                />
                <Metric 
                  icon={Zap} 
                  label="Tegangan Server AC" 
                  value={readingL4?.voltage !== null && readingL4?.voltage !== undefined ? `${Number(readingL4.voltage).toFixed(1)} V` : "-- V"} 
                  detail={readingL4?.voltage ? (readingL4.voltage >= 200 && readingL4.voltage <= 240 ? "Normal (Stabil)" : "Tegangan Tidak Stabil") : "Tidak ada data"}
                  valueClassName={readingL4?.voltage ? (readingL4.voltage >= 200 && readingL4.voltage <= 240 ? "text-emerald-600" : "text-rose-600") : "text-slate-400"}
                />
                <Metric 
                  icon={Radio} 
                  label="Status Sensor L4" 
                  value={onlineL4 ? "Online" : "Offline"} 
                  detail={readingL4 ? `Update: ${clock(readingL4.recordedAt, true)}` : "Belum ada data"}
                  valueClassName={onlineL4 ? "text-emerald-600" : "text-rose-600"}
                />
                <Metric 
                  icon={ShieldCheck} 
                  label="Kondisi Server" 
                  value={statusL4 === "Bahaya" ? "KRITIS" : statusL4 === "Waspada" ? "PERHATIAN" : "AMAN"} 
                  detail={statusL4 === "Normal" ? "Suhu & Tegangan aman" : "Segera periksa AC server!"}
                  valueClassName={statusColor(statusL4)}
                />
              </section>
            </div>

            {/* Bagian Lantai 5 (Ruang Kerja/Lainnya) */}
            <div className="mb-6">
              <h2 className="text-md font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-purple-600" /> Lantai 5 - Ruangan
              </h2>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric 
                  icon={Thermometer} 
                  label="Suhu Ruangan L5" 
                  value={readingL5 ? `${Number(readingL5.temperature).toFixed(1)}°C` : "--°C"} 
                  detail={`Status: ${statusL5}`}
                  valueClassName={statusColor(statusL5)}
                />
                <Metric 
                  icon={Radio} 
                  label="Status Sensor L5" 
                  value={onlineL5 ? "Online" : "Offline"} 
                  detail={readingL5 ? `Update: ${clock(readingL5.recordedAt, true)}` : "Belum ada data"}
                  valueClassName={onlineL5 ? "text-emerald-600" : "text-rose-600"}
                />
              </section>
            </div>

            {/* Grafik & Batas Pengaturan */}
            <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <CardTitle>Tren Suhu Ruangan</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">Perbandingan Suhu Lantai 4 & 5 (°C)</p>
                  </div>
                  <Tabs value={period} onValueChange={setPeriod}>
                    <TabsList>
                      {[1, 6, 24].map(x => (
                        <TabsTrigger key={x} value={`${x}`}>
                          {x} Jam
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </CardHeader>
                <CardContent className="h-80 pl-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -10 }}>
                      <defs>
                        <linearGradient id="tempL4" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0" stopColor="#10b981" stopOpacity={0.18} />
                          <stop offset="1" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="tempL5" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0" stopColor="#8b5cf6" stopOpacity={0.18} />
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
                        formatter={(value, name) => [
                          `${Number(value).toFixed(1)}°C`, 
                          name === "tempL4" ? "Suhu Lantai 4" : "Suhu Lantai 5"
                        ]} 
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
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
                        name="tempL4"
                        type="monotone" 
                        dataKey="tempL4" 
                        stroke="#10b981" 
                        strokeWidth={2.4} 
                        fill="url(#tempL4)" 
                      />
                      <Area 
                        name="tempL5"
                        type="monotone" 
                        dataKey="tempL5" 
                        stroke="#8b5cf6" 
                        strokeWidth={2.4} 
                        fill="url(#tempL5)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Panel Kanan (Batas & Info Cepat) */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Batas Kritis Alarm</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Limit color="bg-emerald-500" label="Normal" value={`≤ ${settings.warningTemperature}°C`} />
                    <Limit color="bg-amber-400" label="Waspada" value={`${settings.warningTemperature}–${settings.dangerTemperature}°C`} />
                    <Limit color="bg-rose-500" label="Bahaya" value={`≥ ${settings.dangerTemperature}°C`} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Status Koneksi</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y">
                    <SystemRow icon={CheckCircle2} label="Website Vercel" />
                    <SystemRow icon={Database} label="Postgres Supabase" />
                    <SystemRow icon={Radio} label="Sensor L4 (Server)" online={onlineL4} />
                    <SystemRow icon={Radio} label="Sensor L5 (Ruangan)" online={onlineL5} />
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Riwayat Terakhir & Ringkasan */}
            <section className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Data Pengukuran Terbaru</CardTitle>
                  <Link href="/riwayat" className="text-xs font-medium text-emerald-600 hover:underline">
                    Lihat semua data
                  </Link>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Sensor ID</TableHead>
                        <TableHead>Suhu</TableHead>
                        <TableHead>Tegangan</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentReadings.length ? (
                        recentReadings.map(row => {
                          const status = getTempStatus(row.temperature)
                          return (
                            <TableRow key={row.id}>
                              <TableCell>{clock(row.recordedAt, true)}</TableCell>
                              <TableCell>
                                <code className="rounded bg-slate-100 px-2 py-1 text-xs">
                                  {row.sensorId === "esp32-lantai4" ? "Lantai 4 (Server)" : "Lantai 5 (Ruang)"}
                                </code>
                              </TableCell>
                              <TableCell className="font-semibold">{Number(row.temperature).toFixed(1)}°C</TableCell>
                              <TableCell>{row.voltage !== null ? `${Number(row.voltage).toFixed(1)} V` : "-- V"}</TableCell>
                              <TableCell>
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
                            Menunggu data masuk dari sensor...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ringkasan Hari Ini (Lantai 4)</CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  <SummaryRow icon={TrendingUp} label="Suhu Tertinggi" value={`${maxTempL4.toFixed(1)}°C`} color="bg-rose-50 text-rose-500" />
                  <SummaryRow icon={TrendingDown} label="Suhu Terendah" value={`${minTempL4.toFixed(1)}°C`} color="bg-blue-50 text-blue-500" />
                  <SummaryRow icon={Activity} label="Suhu Rata-rata" value={`${avgTempL4.toFixed(1)}°C`} color="bg-emerald-50 text-emerald-600" />
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail, valueClassName = "text-emerald-600" }: { icon: any, label: string, value: string, detail: string, valueClassName?: string }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="flex min-h-32 items-center gap-4 p-5">
        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#005a9c]">
          <Icon className="size-7" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className={`truncate text-2xl font-bold ${valueClassName}`}>{value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{detail}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Limit({ color, label, value }: { color: string, label: string, value: string }) {
  return (
    <div className="flex items-center rounded-xl border px-3 py-3 text-sm">
      <span className={`mr-3 size-2 rounded-full ${color}`} />
      <span className="text-slate-600">{label}</span>
      <b className="ml-auto font-medium text-slate-800">{value}</b>
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
        <small className="text-slate-500 block text-[11px] leading-tight">{label}</small>
        <b className="block text-lg font-semibold text-slate-800">{value}</b>
      </span>
    </div>
  )
}

function SystemRow({ icon: Icon, label, online = true }: { icon: any, label: string, online?: boolean }) {
  return (
    <div className="flex items-center py-3 text-sm">
      <Icon className={`mr-2 size-4 ${online ? "text-emerald-600" : "text-rose-600"}`} />
      <span className="text-slate-600">{label}</span>
      <span className={`ml-auto font-medium ${online ? "text-emerald-600" : "text-rose-600"}`}>
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
