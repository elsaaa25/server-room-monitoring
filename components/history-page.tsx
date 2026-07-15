"use client"

import { useEffect, useState, useCallback } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Download, Filter, History, Menu, Search, Thermometer } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { defaultMonitoringSettings, readMonitoringSettings, type MonitoringSettings } from "@/lib/monitoring-settings"

type Status = "Normal" | "Waspada" | "Bahaya"
type Reading = { 
  id: number
  recordedAt: string
  temperature: number
  voltage: number | null
  sensorId: string 
}

const pageSize = 10

const formatDate = (value: string) => 
  new Intl.DateTimeFormat("id-ID", { 
    timeZone: "Asia/Bangkok", 
    day: "2-digit", 
    month: "short", 
    year: "numeric" 
  }).format(new Date(value))

const formatTime = (value: string) => 
  new Intl.DateTimeFormat("id-ID", { 
    timeZone: "Asia/Bangkok", 
    hour: "2-digit", 
    minute: "2-digit", 
    second: "2-digit" 
  }).format(new Date(value))

export function HistoryPage() {
  const [settings, setSettings] = useState<MonitoringSettings>(defaultMonitoringSettings)
  const [statusFilter, setStatusFilter] = useState<"Semua" | Status>("Semua")
  const [search, setSearch] = useState("")
  // Set default tanggal hari ini di WIB (Asia/Bangkok)
  const [date, setDate] = useState(() => {
    const d = new Date()
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
  })
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Load settings dari Database PostgreSQL
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings")
        const json = await res.json()
        if (json.success) {
          setSettings(json.data)
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan di riwayat:", err)
      }
    }
    fetchSettings()
  }, [])

  // Fetch data dari database berdasarkan tanggal & pencarian sensorId
  const fetchHistoryData = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/sensor/history?date=${date}`
      if (search.trim()) {
        url += `&sensorId=${search.trim()}`
      }
      
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) {
        setReadings(json.data)
      }
    } catch (err) {
      console.error("Gagal memuat riwayat sensor:", err)
    } finally {
      setLoading(false)
    }
  }, [date, search])

  // Triger fetch ketika parameter berubah
  useEffect(() => {
    fetchHistoryData()
    setPage(1) // Reset ke halaman pertama saat filter berubah
  }, [fetchHistoryData])

  const getStatus = (temperature: number): Status => 
    temperature >= settings.dangerTemperature ? "Bahaya" : temperature > settings.warningTemperature ? "Waspada" : "Normal"

  // Filter client-side hanya untuk Status (karena setting threshold berada di localstorage client)
  const filtered = readings.filter(item => {
    const status = getStatus(item.temperature)
    const matchesStatus = statusFilter === "Semua" || status === statusFilter
    return matchesStatus
  })

  // Pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const counts = {
    total: filtered.length,
    normal: filtered.filter(x => getStatus(x.temperature) === "Normal").length,
    warning: filtered.filter(x => getStatus(x.temperature) === "Waspada").length,
    danger: filtered.filter(x => getStatus(x.temperature) === "Bahaya").length
  }

  const setFilter = (value: "Semua" | Status) => {
    setStatusFilter(value)
    setPage(1)
  }

  // Export Data ke file CSV
  const exportCsv = () => {
    if (!filtered.length) return
    const csvHeaders = "Waktu Perekaman,Sensor ID,Suhu (C),Tegangan (V),Status\n"
    const csvRows = filtered.map(item => 
      `"${item.recordedAt}","${item.sensorId}",${item.temperature},${item.voltage !== null ? item.voltage : '""'},"${getStatus(item.temperature)}"`
    ).join("\n")
    
    const url = URL.createObjectURL(new Blob([csvHeaders + csvRows], { type: "text/csv;charset=utf-8;" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `riwayat-monitoring-${date || "semua"}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen p-2 lg:flex bg-slate-50/50">
      <aside className="sticky top-2 hidden h-[calc(100vh-1rem)] w-56 shrink-0 overflow-hidden rounded-3xl border bg-white shadow-sm lg:block">
        <AppSidebar />
      </aside>
      
      <main className="min-w-0 flex-1 px-2 pb-8 lg:px-6">
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
            <h1 className="text-xl font-semibold sm:text-2xl text-slate-800">Riwayat Pengukuran</h1>
            <p className="text-sm text-slate-500 font-normal">Telusuri seluruh data log sensor dari database</p>
          </div>
          <Button onClick={exportCsv} variant="outline" className="ml-auto" disabled={!filtered.length}>
            <Download className="mr-2 size-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </header>

        {/* Ringkasan Jumlah Data */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary icon={History} label="Total Data Terfilter" value={counts.total} color="slate" />
          <Summary icon={Thermometer} label="Status Normal" value={counts.normal} color="green" />
          <Summary icon={Thermometer} label="Status Waspada" value={counts.warning} color="amber" />
          <Summary icon={Thermometer} label="Status Bahaya" value={counts.danger} color="rose" />
        </section>

        {/* Tabel Data */}
        <Card className="mt-4 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Data Log Sensor</CardTitle>
              <span className="text-xs text-slate-500 font-medium">Batas Alert: {settings.warningTemperature}°C / {settings.dangerTemperature}°C</span>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              {/* Input Pencarian Sensor ID */}
              <label className="flex h-10 items-center gap-2 rounded-xl border bg-white px-3 focus-within:ring-2 focus-within:ring-emerald-500/30">
                <Search className="size-4 text-slate-400" />
                <input 
                  value={search} 
                  onChange={event => setSearch(event.target.value)} 
                  placeholder="Cari ID sensor (misal: esp32-lantai4)..." 
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none text-slate-700" 
                />
              </label>

              {/* Input Tanggal */}
              <label className="flex h-10 items-center gap-2 rounded-xl border bg-white px-3 focus-within:ring-2 focus-within:ring-emerald-500/30">
                <CalendarDays className="size-4 text-slate-400" />
                <input 
                  type="date" 
                  value={date} 
                  onChange={event => setDate(event.target.value)} 
                  className="bg-transparent text-sm outline-none text-slate-700" 
                />
              </label>

              {/* Filter Tombol Status */}
              <div className="flex items-center gap-1 rounded-xl border bg-white p-1">
                <Filter className="mx-2 size-4 text-slate-400" />
                {(["Semua", "Normal", "Waspada", "Bahaya"] as const).map(value => (
                  <button 
                    key={value} 
                    onClick={() => setFilter(value)} 
                    className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${statusFilter === value ? "bg-emerald-50 font-semibold text-[#005a9c]" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="h-60 grid place-items-center text-sm text-slate-400">
                Memuat data dari database...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Waktu</TableHead>
                        <TableHead>Sensor ID</TableHead>
                        <TableHead>Suhu (°C)</TableHead>
                        <TableHead>Tegangan (V)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="pr-6">Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.length ? (
                        visible.map(item => {
                          const status = getStatus(item.temperature)
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="pl-6">
                                <b className="block text-sm font-semibold text-slate-800">{formatTime(item.recordedAt)}</b>
                                <span className="text-xs text-slate-400">{formatDate(item.recordedAt)}</span>
                              </TableCell>
                              <TableCell>
                                <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-600">
                                  {item.sensorId}
                                </code>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-800">{Number(item.temperature).toFixed(1)}°C</TableCell>
                              <TableCell className="text-slate-700">{item.voltage !== null && item.voltage !== undefined ? `${Number(item.voltage).toFixed(1)} V` : "-- V"}</TableCell>
                              <TableCell>
                                <StatusBadge status={status} />
                              </TableCell>
                              <TableCell className="pr-6 text-xs text-slate-500">
                                {status === "Normal" ? "Kondisi stabil & aman" : status === "Waspada" ? "Suhu mendekati batas kritis" : "Suhu berbahaya, periksa AC!"}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-40 text-center text-slate-400">
                            Tidak ada data untuk tanggal ini atau filter yang dipilih.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination Controls */}
                <div className="flex flex-col items-center justify-between gap-3 border-t px-5 py-4 sm:flex-row bg-slate-50/50">
                  <p className="text-xs text-slate-500 font-medium">
                    Menampilkan {visible.length ? ((safePage - 1) * pageSize) + 1 : 0}–{Math.min(safePage * pageSize, filtered.length)} dari {filtered.length} data
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={safePage === 1} 
                      onClick={() => setPage(value => Math.max(1, value - 1))}
                    >
                      <ChevronLeft className="size-4 mr-1" />
                      Sebelumnya
                    </Button>
                    <span className="min-w-20 text-center text-xs text-slate-600 font-medium">
                      Halaman {safePage} / {pageCount}
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={safePage === pageCount} 
                      onClick={() => setPage(value => Math.min(pageCount, value + 1))}
                    >
                      Berikutnya
                      <ChevronRight className="size-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function Summary({ icon: Icon, label, value, color }: { icon: any, label: string, value: number, color: "slate" | "green" | "amber" | "rose" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-500",
    rose: "bg-rose-50 text-rose-500"
  }
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <span className={`grid size-10 place-items-center rounded-full ${styles[color]}`}>
          <Icon className="size-5" />
        </span>
        <span>
          <small className="text-slate-500 block text-[11px] leading-tight font-medium">{label}</small>
          <b className="block text-xl font-bold text-slate-800">{value}</b>
        </span>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const styles = {
    Normal: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    Waspada: "bg-amber-50 text-amber-700 hover:bg-amber-50",
    Bahaya: "bg-rose-50 text-rose-700 hover:bg-rose-50"
  }
  return <Badge variant="secondary" className={`${styles[status]} font-semibold`}>● {status}</Badge>
}
