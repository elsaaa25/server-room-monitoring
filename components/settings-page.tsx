"use client"

import { useEffect, useState } from "react"
import { Bell, Check, Clock3, Menu, Radio, RotateCcw, Save, Server, Thermometer } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { defaultMonitoringSettings as defaults, type MonitoringSettings as Settings } from "@/lib/monitoring-settings"

export function SettingsPage() {
  const [settings, setSettings] = useState(defaults)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load Settings dari PostgreSQL Database via API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings")
        const json = await res.json()
        if (json.success) {
          setSettings(json.data)
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan dari database:", err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => 
    setSettings(current => ({ ...current, [key]: value }))

  // Simpan Settings ke PostgreSQL Database via API
  const save = async () => {
    if (settings.warningTemperature >= settings.dangerTemperature) return
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      })
      const json = await res.json()
      if (json.success) {
        setSaved(true)
        // Kirim event agar tab browser lain (jika ada) terupdate otomatis
        window.dispatchEvent(new CustomEvent("monitoring-settings-changed", { detail: settings }))
        setTimeout(() => setSaved(false), 2500)
      } else {
        alert(json.error || "Gagal menyimpan pengaturan")
      }
    } catch (err) {
      console.error("Gagal menyimpan pengaturan:", err)
      alert("Terjadi kesalahan jaringan.")
    }
  }

  const reset = () => { 
    setSettings(defaults) 
  }

  const valid = settings.warningTemperature < settings.dangerTemperature

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
            <h1 className="text-xl font-semibold sm:text-2xl text-slate-800">Pengaturan Sistem</h1>
            <p className="text-sm text-slate-500 font-normal">Konfigurasi batas alarm suhu, interval refresh, dan notifikasi</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={reset} disabled={loading}>
              <RotateCcw className="size-4 mr-1" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button 
              onClick={save} 
              disabled={!valid || loading} 
              className="bg-[#005a9c] hover:bg-[#004579]"
            >
              {saved ? <Check className="size-4 mr-1" /> : <Save className="size-4 mr-1" />}
              {saved ? "Tersimpan" : "Simpan"}
            </Button>
          </div>
        </header>

        {saved && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check className="size-4" />
            Pengaturan berhasil disimpan secara permanen di database PostgreSQL cloud.
          </div>
        )}

        {loading ? (
          <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">
            Memuat konfigurasi sistem dari database...
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Batas Suhu */}
            <SettingsCard icon={Thermometer} title="Batas Alarm Suhu" description="Tentukan ambang batas suhu waspada dan bahaya untuk memicu alarm.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Batas Waspada" hint="Status waspada dimulai di atas nilai ini">
                  <NumberInput value={settings.warningTemperature} onChange={value => update("warningTemperature", value)} suffix="°C" min={20} max={40} />
                </Field>
                <Field label="Batas Bahaya" hint="Status bahaya dimulai pada nilai ini">
                  <NumberInput value={settings.dangerTemperature} onChange={value => update("dangerTemperature", value)} suffix="°C" min={20} max={50} />
                </Field>
              </div>
              {!valid && <p className="mt-3 text-sm text-rose-600">Batas bahaya harus lebih tinggi dari batas waspada.</p>}
              <div className="mt-5 flex flex-wrap gap-3 text-xs">
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Normal ≤ {Number(settings.warningTemperature)}°C</Badge>
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Waspada {Number(settings.warningTemperature)}–{Number(settings.dangerTemperature)}°C</Badge>
                <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Bahaya ≥ {Number(settings.dangerTemperature)}°C</Badge>
              </div>
            </SettingsCard>

            {/* Pembaruan Data */}
            <SettingsCard icon={Clock3} title="Pembaruan Data & Offline" description="Atur kecepatan refresh dashboard dan batas toleransi sensor sebelum dianggap mati.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Interval Refresh Dashboard" hint="Disarankan antara 3–5 detik">
                  <NumberInput value={settings.refreshInterval} onChange={value => update("refreshInterval", value)} suffix="detik" min={3} max={60} />
                </Field>
                <Field label="Batas Offline Sensor" hint="Dianggap mati jika tidak ada data baru dalam durasi ini">
                  <NumberInput value={settings.offlineTimeout} onChange={value => update("offlineTimeout", value)} suffix="detik" min={10} max={300} />
                </Field>
              </div>
            </SettingsCard>

            {/* Perangkat Sensor */}
            <SettingsCard icon={Radio} title="Perangkat Sensor ESP32" description="Pengaturan identitas sensor utama untuk validasi payload.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama Perangkat">
                  <TextInput value={settings.sensorName} onChange={value => update("sensorName", value)} />
                </Field>
                <Field label="Sensor ID Utama" hint="Harus sama dengan nama ID sensor di hardware ESP32">
                  <TextInput value={settings.sensorId} onChange={value => update("sensorId", value)} mono />
                </Field>
              </div>
              <Separator className="my-5" />
              <div className="flex items-center">
                <div className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Server className="size-5" />
                </div>
                <div className="ml-3">
                  <b className="block text-sm text-slate-800">Koneksi Database Cloud</b>
                  <span className="text-xs text-slate-500">Penyimpanan Terpusat Supabase</span>
                </div>
                <Badge className="ml-auto bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Aktif</Badge>
              </div>
            </SettingsCard>

            {/* Notifikasi */}
            <SettingsCard icon={Bell} title="Pusat Peringatan & Suara" description="Aktifkan alarm suara atau notifikasi browser jika suhu kritis.">
              <Toggle 
                label="Notifikasi Desktop/Browser" 
                description="Tampilkan notifikasi mengambang saat suhu terdeteksi Waspada atau Bahaya" 
                checked={settings.browserNotification} 
                onChange={value => update("browserNotification", value)} 
              />
              <Separator className="my-2" />
              <Toggle 
                label="Alarm Suara Peringatan" 
                description="Bunyikan efek suara sirine ketika suhu menyentuh batas Bahaya" 
                checked={settings.soundAlert} 
                onChange={value => update("soundAlert", value)} 
              />
            </SettingsCard>
          </div>
        )}
        <p className="mt-5 text-center text-xs text-slate-400">
          Pengaturan ini disimpan di database PostgreSQL. Perubahan akan langsung berdampak pada semua HP, laptop, dan komputer pemantau.
        </p>
      </main>
    </div>
  )
}

function SettingsCard({ icon: Icon, title, description, children }: { icon: any, title: string, description: string, children: React.ReactNode }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#005a9c]">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Field({ label, hint, children }: { label: string, hint?: string, children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-slate-400 leading-tight">{hint}</span>}
    </label>
  )
}

function NumberInput({ value, onChange, suffix, min, max }: { value: number, onChange: (v: number) => void, suffix: string, min: number, max: number }) {
  return (
    <div className="flex h-10 overflow-hidden rounded-xl border bg-white focus-within:ring-2 focus-within:ring-emerald-500/30">
      <input 
        type="number" 
        value={value} 
        min={min} 
        max={max} 
        onChange={event => onChange(Number(event.target.value))} 
        className="min-w-0 flex-1 bg-transparent px-3 outline-none text-slate-700 font-medium"
      />
      <span className="grid place-items-center border-l bg-slate-50 px-3 text-xs text-slate-500 font-medium">{suffix}</span>
    </div>
  )
}

function TextInput({ mono = false, value, onChange }: { mono?: boolean, value: string, onChange: (v: string) => void }) {
  return (
    <input 
      value={value} 
      onChange={event => onChange(event.target.value)} 
      className={`h-10 w-full rounded-xl border bg-white px-3 outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-700 font-medium ${mono ? "font-mono text-sm" : ""}`} 
    />
  )
}

function Toggle({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <button 
        type="button" 
        role="switch" 
        aria-checked={checked} 
        onClick={() => onChange(!checked)} 
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#005a9c]" : "bg-slate-200"}`}
      >
        <span className={`absolute top-1 size-4 rounded-full bg-white shadow transition-transform ${checked ? "left-6" : "left-1"}`} />
      </button>
      <div>
        <b className="block text-sm text-slate-800">{label}</b>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}
