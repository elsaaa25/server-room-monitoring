"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bell, History, House, Radio, Server, Settings, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type AppSidebarProps = {
  showCloseButton?: boolean
  onClose?: () => void
}

const navigation = [
  { label: "Dashboard", icon: House, href: "/" },
  { label: "Grafik", icon: Activity, href: "/grafik" },
  { label: "Riwayat", icon: History, href: "/riwayat" },
  { label: "Peringatan", icon: Bell, href: "/peringatan" },
  { label: "Pengaturan", icon: Settings, href: "/pengaturan" },
]

export function AppSidebar({
  showCloseButton = false,
  onClose,
}: AppSidebarProps) {
  return (
    <div className="relative flex h-full flex-col">
      {showCloseButton && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup sidebar"
          title="Tutup sidebar"
          className="absolute right-4 top-5 z-20 grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="size-5" />
        </button>
      )}

      {/* Ikon server milikmu */}
      {/* Menu Dashboard, Grafik, Riwayat, dan seterusnya */}
    </div>
  )
}
