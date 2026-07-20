"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Bell,
  History,
  House,
  Radio,
  Server,
  Settings,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"

type AppSidebarProps = {
  showCloseButton?: boolean
  onClose?: () => void
}

const navigation = [
  {
    label: "Dashboard",
    icon: House,
    href: "/",
  },
  {
    label: "Grafik",
    icon: Activity,
    href: "/grafik",
  },
  {
    label: "Riwayat",
    icon: History,
    href: "/riwayat",
  },
  {
    label: "Peringatan",
    icon: Bell,
    href: "/peringatan",
  },
  {
    label: "Pengaturan",
    icon: Settings,
    href: "/pengaturan",
  },
]

export function AppSidebar({
  showCloseButton = false,
  onClose,
}: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="relative flex h-full flex-col bg-white p-4">
      {/* Tombol tutup sidebar desktop */}
      {showCloseButton && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup sidebar"
          title="Tutup sidebar"
          className="absolute right-4 top-4 z-20 grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005a9c]/40"
        >
          <X className="size-5" />
        </button>
      )}

      {/* Logo */}
      <Link
        href="/"
        aria-label="Buka Dashboard"
        className="mb-10 grid size-12 place-items-center rounded-2xl bg-[#005a9c] text-white shadow-lg shadow-blue-200 transition hover:bg-[#004579]"
      >
        <Server className="size-6" />
      </Link>

      {/* Navigasi */}
      <nav className="space-y-2">
        {navigation.map(
          ({ label, icon: Icon, href }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href)

            return (
              <Button
                key={href}
                asChild
                variant="ghost"
                className={`w-full justify-start gap-3 rounded-xl ${
                  active
                    ? "bg-blue-50 font-medium text-[#005a9c] hover:bg-blue-100 hover:text-[#005a9c]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Link href={href}>
                  <Icon className="size-5 shrink-0" />
                  <span>{label}</span>
                </Link>
              </Button>
            )
          },
        )}
      </nav>

      {/* Identitas monitor */}
      <div className="mt-auto flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
        <Radio className="size-4 shrink-0 text-[#005a9c]" />
        <span>AirNav Banyuwangi</span>
      </div>
    </div>
  )
}