"use client"

import {
  useCallback,
  useEffect,
  useState,
} from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type ActiveAlert = {
  id: number
  level: "Waspada" | "Bahaya"
  status: "Aktif" | "Ditangani"
}

export function AlertHeaderButton() {
  const [activeCount, setActiveCount] =
    useState(0)

  const [dangerCount, setDangerCount] =
    useState(0)

  const loadAlerts = useCallback(
    async () => {
      try {
        const response = await fetch(
          "/api/alerts?status=Aktif&limit=100",
          {
            cache: "no-store",
          },
        )

        const json = await response.json()

        if (!response.ok || !json.success) {
          return
        }

        const alerts: ActiveAlert[] =
          json.data ?? []

        setActiveCount(alerts.length)

        setDangerCount(
          alerts.filter(
            alert =>
              alert.level === "Bahaya",
          ).length,
        )
      } catch (error) {
        console.error(
          "Gagal mengambil jumlah peringatan:",
          error,
        )
      }
    },
    [],
  )

  useEffect(() => {
    void loadAlerts()

    const timer = window.setInterval(
      () => void loadAlerts(),
      5_000,
    )

    return () => {
      window.clearInterval(timer)
    }
  }, [loadAlerts])

  const hasDanger = dangerCount > 0
  const hasActive = activeCount > 0

  return (
    <Button
      asChild
      variant="outline"
      className={
        hasDanger
          ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
          : hasActive
            ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
            : "border-slate-200 bg-white text-slate-600"
      }
    >
      <Link href="/peringatan">
        <Bell
          className={
            hasDanger
              ? "animate-pulse"
              : ""
          }
        />

        <span className="hidden sm:inline">
          Peringatan
        </span>

        {activeCount > 0 && (
          <Badge
            className={
              hasDanger
                ? "bg-rose-600 text-white hover:bg-rose-600"
                : "bg-amber-500 text-white hover:bg-amber-500"
            }
          >
            {activeCount}
          </Badge>
        )}
      </Link>
    </Button>
  )
}