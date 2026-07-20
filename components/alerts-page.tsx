"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Radio,
  Search,
  ShieldAlert,
  Thermometer,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  defaultMonitoringSettings,
  type MonitoringSettings,
} from "@/lib/monitoring-settings"
import { AppShell } from "@/components/app-shell"

type Level = "Waspada" | "Bahaya"
type AlertStatus = "Aktif" | "Ditangani"

type AlertItem = {
  id: number
  level: Level
  status: AlertStatus
  temperature: number
  sensorId: string
  createdAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
  handledByName: string | null
  title: string
  detail: string
}

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))

const sensorLabel = (sensorId: string) =>
  sensorId === "TEMP-L4"
    ? "Lantai 4 (Ruang Server)"
    : sensorId

export function AlertsPage() {
  const [settings, setSettings] =
    useState<MonitoringSettings>(
      defaultMonitoringSettings,
    )
  const [alerts, setAlerts] =
    useState<AlertItem[]>([])
  const [level, setLevel] =
    useState<"Semua" | Level>("Semua")
  const [status, setStatus] =
    useState<"Semua" | AlertStatus>("Semua")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] =
    useState<string | null>(null)
  const [actionId, setActionId] =
    useState<number | "all" | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings", {
        cache: "no-store",
      })

      const json = await response.json()

      if (response.ok && json.success) {
        setSettings(json.data)
      }
    } catch (fetchError) {
      console.error(
        "Gagal mengambil pengaturan:",
        fetchError,
      )
    }
  }, [])

  const fetchAlerts = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true)
      }

      try {
        const response = await fetch(
          "/api/alerts?limit=200",
          {
            cache: "no-store",
          },
        )
        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ??
              "Gagal mengambil data peringatan",
          )
        }

        const normalized: AlertItem[] = (
          json.data ?? []
        ).map((item: AlertItem) => ({
          ...item,
          id: Number(item.id),
          temperature: Number(item.temperature),
        }))

        setAlerts(normalized)
        setError(null)
      } catch (fetchError) {
        console.error(
          "Gagal mengambil peringatan:",
          fetchError,
        )
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Gagal mengambil data peringatan",
        )
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    void fetchSettings()
    void fetchAlerts()
  }, [fetchAlerts, fetchSettings])

  useEffect(() => {
    const intervalSeconds = Math.max(
      Number(settings.refreshInterval) || 5,
      5,
    )

    const timer = window.setInterval(() => {
      void fetchAlerts(true)
    }, intervalSeconds * 1000)

    return () => window.clearInterval(timer)
  }, [fetchAlerts, settings.refreshInterval])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return alerts.filter(item => {
      const matchesLevel =
        level === "Semua" || item.level === level
      const matchesStatus =
        status === "Semua" ||
        item.status === status
      const searchableText = [
        item.title,
        item.detail,
        item.sensorId,
        sensorLabel(item.sensorId),
      ]
        .join(" ")
        .toLowerCase()

      return (
        matchesLevel &&
        matchesStatus &&
        searchableText.includes(keyword)
      )
    })
  }, [alerts, level, search, status])

  const active = alerts.filter(
    item => item.status === "Aktif",
  ).length
  const danger = alerts.filter(
    item =>
      item.level === "Bahaya" &&
      item.status === "Aktif",
  ).length
  const handled = alerts.filter(
    item => item.status === "Ditangani",
  ).length

  const acknowledge = async (id: number) => {
    setActionId(id)

    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ??
            "Gagal menangani peringatan",
        )
      }

      await fetchAlerts(true)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Gagal menangani peringatan",
      )
    } finally {
      setActionId(null)
    }
  }

  const acknowledgeAll = async () => {
    setActionId("all")

    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ all: true }),
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ??
            "Gagal menangani semua peringatan",
        )
      }

      await fetchAlerts(true)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Gagal menangani semua peringatan",
      )
    } finally {
      setActionId(null)
    }
  }

  return (
    <AppShell
      title="Peringatan"
      description="Pantau dan tindak lanjuti kejadian suhu ruang server"
      actions={
        <Button
          variant="outline"
          disabled={
            active === 0 || actionId !== null
          }
          onClick={() => void acknowledgeAll()}
        >
          <Check />
          {actionId === "all"
            ? "Memproses..."
            : "Tandai Semua Ditangani"}
        </Button>
      }
    >
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary
            icon={Bell}
            label="Peringatan Aktif"
            value={active}
            color="amber"
          />
          <Summary
            icon={ShieldAlert}
            label="Bahaya Aktif"
            value={danger}
            color="rose"
          />
          <Summary
            icon={CheckCircle2}
            label="Sudah Ditangani"
            value={handled}
            color="green"
          />
          <Summary
            icon={Thermometer}
            label="Batas Suhu"
            value={`${Number(
              settings.warningTemperature,
            )}°C / ${Number(
              settings.dangerTemperature,
            )}°C`}
            color="blue"
          />
        </section>

        <Card className="mt-6">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold">
                Daftar Peringatan
              </CardTitle>
              <span className="text-xs text-slate-500">
                {filtered.length} kejadian
              </span>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex min-w-0 flex-1 items-center rounded-xl border bg-white px-3">
                <Search className="size-4 text-slate-400" />
                <input
                  value={search}
                  onChange={event =>
                    setSearch(event.target.value)
                  }
                  placeholder="Cari peringatan atau sensor..."
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <FilterGroup
                  values={[
                    "Semua",
                    "Aktif",
                    "Ditangani",
                  ]}
                  active={status}
                  onChange={value =>
                    setStatus(
                      value as
                        | "Semua"
                        | AlertStatus,
                    )
                  }
                />
                <FilterGroup
                  values={[
                    "Semua",
                    "Waspada",
                    "Bahaya",
                  ]}
                  active={level}
                  onChange={value =>
                    setLevel(
                      value as "Semua" | Level,
                    )
                  }
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {error && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <span>{error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void fetchAlerts()
                  }
                >
                  Coba Lagi
                </Button>
              </div>
            )}

            {loading ? (
              <div className="grid min-h-48 place-items-center text-sm text-slate-500">
                Mengambil data peringatan...
              </div>
            ) : filtered.length > 0 ? (
              filtered.map(item => (
                <AlertRow
                  key={item.id}
                  item={item}
                  processing={actionId === item.id}
                  onAcknowledge={() =>
                    void acknowledge(item.id)
                  }
                />
              ))
            ) : (
              <div className="grid min-h-48 place-items-center rounded-xl border border-dashed text-center text-sm text-slate-400">
                Tidak ada peringatan yang sesuai.
              </div>
            )}
          </CardContent>
        </Card>
    </AppShell>
  )
}

function AlertRow({
  item,
  processing,
  onAcknowledge,
}: {
  item: AlertItem
  processing: boolean
  onAcknowledge: () => void
}) {
  const visual = {
    Bahaya: {
      icon: ShieldAlert,
      box: "border-rose-200 bg-rose-50/40",
      bubble: "bg-rose-100 text-rose-600",
      badge: "bg-rose-100 text-rose-700",
    },
    Waspada: {
      icon: AlertTriangle,
      box: "border-amber-200 bg-amber-50/40",
      bubble: "bg-amber-100 text-amber-600",
      badge: "bg-amber-100 text-amber-700",
    },
  }[item.level]

  const Icon = visual.icon

  return (
    <div
      className={`rounded-2xl border p-4 ${visual.box}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-full ${visual.bubble}`}
        >
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">
              {item.title}
            </h3>
            <Badge
              variant="secondary"
              className={visual.badge}
            >
              {item.level}
            </Badge>
            {item.status === "Ditangani" && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700"
              >
                Ditangani
              </Badge>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {item.detail}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Thermometer className="size-3.5" />
              {item.temperature.toFixed(2)}°C
            </span>
            <span className="flex items-center gap-1.5">
              <Radio className="size-3.5" />
              {sensorLabel(item.sensorId)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {dateTime(item.createdAt)} WIB
            </span>
          </div>

          {item.status === "Ditangani" &&
            item.handledByName && (
              <p className="mt-2 text-xs text-slate-400">
                Ditangani oleh {item.handledByName}
              </p>
            )}

          {item.resolvedAt && (
            <p className="mt-1 text-xs text-emerald-600">
              Suhu kembali normal pada{" "}
              {dateTime(item.resolvedAt)} WIB
            </p>
          )}
        </div>

        {item.status === "Aktif" && (
          <Button
            size="sm"
            disabled={processing}
            onClick={onAcknowledge}
          >
            <Check />
            {processing
              ? "Memproses..."
              : "Tangani"}
          </Button>
        )}
      </div>
    </div>
  )
}

function Summary({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Bell
  label: string
  value: number | string
  color:
    | "amber"
    | "rose"
    | "green"
    | "blue"
}) {
  const styles = {
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
  }

  return (
    <Card>
      <CardContent className="flex min-h-28 items-center gap-4 p-5">
        <span
          className={`grid size-12 place-items-center rounded-full ${styles[color]}`}
        >
          <Icon className="size-5" />
        </span>
        <span>
          <small className="block text-xs text-slate-500">
            {label}
          </small>
          <b className="text-xl text-slate-800">
            {value}
          </b>
        </span>
      </CardContent>
    </Card>
  )
}

function FilterGroup({
  values,
  active,
  onChange,
}: {
  values: string[]
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex rounded-xl border bg-white p-1">
      {values.map(value => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition ${
            active === value
              ? "bg-emerald-50 font-medium text-emerald-700"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  )
}