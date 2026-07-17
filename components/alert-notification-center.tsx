"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { usePathname } from "next/navigation"

import { playAlertSound } from "@/lib/alert-sound"
import {
  defaultMonitoringSettings,
  type MonitoringSettings,
} from "@/lib/monitoring-settings"

type ActiveAlert = {
  id: number
  level: "Waspada" | "Bahaya"
  status: "Aktif" | "Ditangani"
  temperature: number
  sensorId: string
  title: string
  detail: string
  createdAt: string
}

const SEEN_ALERTS_KEY =
  "server-room-seen-alert-ids-v1"
const MAX_SEEN_IDS = 100

function readSeenAlertIds() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SEEN_ALERTS_KEY) ?? "[]",
    )

    if (!Array.isArray(parsed)) {
      return new Set<number>()
    }

    return new Set(
      parsed
        .map(Number)
        .filter(Number.isFinite),
    )
  } catch {
    return new Set<number>()
  }
}

function writeSeenAlertIds(ids: Set<number>) {
  const values = Array.from(ids).slice(-MAX_SEEN_IDS)

  localStorage.setItem(
    SEEN_ALERTS_KEY,
    JSON.stringify(values),
  )
}

function showBrowserNotification(alert: ActiveAlert) {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return
  }

  const notification = new Notification(alert.title, {
    body:
      `${alert.temperature.toFixed(2)}°C — ` +
      alert.detail,
    icon: "/favicon.ico",
    tag: `temperature-alert-${alert.id}`,
    requireInteraction: alert.level === "Bahaya",
  })

  notification.onclick = () => {
    window.focus()
    window.location.href = "/peringatan"
    notification.close()
  }
}

export function AlertNotificationCenter() {
  const pathname = usePathname()
  const [settings, setSettings] =
    useState<MonitoringSettings>(
      defaultMonitoringSettings,
    )
  const firstCheckRef = useRef(true)
  const checkingRef = useRef(false)

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings", {
        cache: "no-store",
      })

      const json = await response.json()

      if (response.ok && json.success) {
        setSettings({
          ...defaultMonitoringSettings,
          ...json.data,
          warningTemperature: Number(
            json.data.warningTemperature,
          ),
          dangerTemperature: Number(
            json.data.dangerTemperature,
          ),
          refreshInterval: Number(
            json.data.refreshInterval,
          ),
          offlineTimeout: Number(
            json.data.offlineTimeout,
          ),
          browserNotification: Boolean(
            json.data.browserNotification,
          ),
          soundAlert: Boolean(
            json.data.soundAlert,
          ),
        })
      }
    } catch (error) {
      console.error(
        "Gagal mengambil pengaturan notifikasi:",
        error,
      )
    }
  }, [])

  const checkActiveAlerts = useCallback(async () => {
    if (checkingRef.current) {
      return
    }

    checkingRef.current = true

    try {
      const response = await fetch(
        "/api/alerts?status=Aktif&limit=20",
        {
          cache: "no-store",
        },
      )

      if (response.status === 401) {
        return
      }

      const json = await response.json()

      if (!response.ok || !json.success) {
        return
      }

      const alerts: ActiveAlert[] = (
        json.data ?? []
      )
        .map((item: ActiveAlert) => ({
          ...item,
          id: Number(item.id),
          temperature: Number(item.temperature),
        }))
        .filter(
          (item: ActiveAlert) =>
            item.status === "Aktif" &&
            Number.isFinite(item.id) &&
            Number.isFinite(item.temperature),
        )

      const seenIds = readSeenAlertIds()

      // Saat komponen pertama dipasang, tandai peringatan lama
      // sebagai sudah dilihat supaya browser tidak membanjiri
      // pengguna dengan notifikasi historis.
      if (
        firstCheckRef.current &&
        localStorage.getItem(SEEN_ALERTS_KEY) === null
      ) {
        for (const alert of alerts) {
          seenIds.add(alert.id)
        }

        writeSeenAlertIds(seenIds)
        firstCheckRef.current = false
        return
      }

      firstCheckRef.current = false

      // API mengirim terbaru dahulu. Balik agar urutan notifikasi
      // berjalan dari kejadian lama ke kejadian terbaru.
      const newAlerts = alerts
        .filter(alert => !seenIds.has(alert.id))
        .reverse()

      for (const alert of newAlerts) {
        if (settings.browserNotification) {
          showBrowserNotification(alert)
        }

        if (
          settings.soundAlert &&
          alert.level === "Bahaya"
        ) {
          try {
            await playAlertSound("danger")
          } catch (error) {
            console.warn(
              "Alarm suara diblokir browser:",
              error,
            )
          }
        }

        seenIds.add(alert.id)
      }

      if (newAlerts.length > 0) {
        writeSeenAlertIds(seenIds)
      }
    } catch (error) {
      console.error(
        "Gagal memeriksa peringatan aktif:",
        error,
      )
    } finally {
      checkingRef.current = false
    }
  }, [
    settings.browserNotification,
    settings.soundAlert,
  ])

  useEffect(() => {
    if (pathname === "/login") {
      return
    }

    void loadSettings()

    const settingsTimer = window.setInterval(
      () => void loadSettings(),
      30_000,
    )

    const handleSettingsChanged = (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<MonitoringSettings>

      if (customEvent.detail) {
        setSettings(customEvent.detail)
      } else {
        void loadSettings()
      }
    }

    window.addEventListener(
      "monitoring-settings-changed",
      handleSettingsChanged,
    )

    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(
            "server-room-monitoring-settings",
          )
        : null

    channel?.addEventListener("message", () => {
      void loadSettings()
    })

    return () => {
      window.clearInterval(settingsTimer)
      window.removeEventListener(
        "monitoring-settings-changed",
        handleSettingsChanged,
      )
      channel?.close()
    }
  }, [loadSettings, pathname])

  useEffect(() => {
    if (pathname === "/login") {
      return
    }

    void checkActiveAlerts()

    const intervalSeconds = Math.min(
      Math.max(
        Number(settings.refreshInterval) || 5,
        3,
      ),
      60,
    )

    const alertTimer = window.setInterval(
      () => void checkActiveAlerts(),
      intervalSeconds * 1000,
    )

    return () => window.clearInterval(alertTimer)
  }, [
    checkActiveAlerts,
    pathname,
    settings.refreshInterval,
  ])

  return null
}