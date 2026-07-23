"use client"

import {
  useEffect,
  useState,
} from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Bell,
  History,
  House,
  Moon,
  Radio,
  Server,
  Settings,
  Sun,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
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

  const [theme, setTheme] =
    useState<"light" | "dark">(
      "light",
    )

  useEffect(() => {
    const isDark =
      document.documentElement.classList.contains(
        "dark",
      )

    setTheme(
      isDark ? "dark" : "light",
    )
  }, [])

  const toggleTheme = () => {
    const nextTheme =
      theme === "light"
        ? "dark"
        : "light"

    setTheme(nextTheme)

    if (nextTheme === "dark") {
      document.documentElement.classList.add(
        "dark",
      )

      localStorage.setItem(
        "theme",
        "dark",
      )
    } else {
      document.documentElement.classList.remove(
        "dark",
      )

      localStorage.setItem(
        "theme",
        "light",
      )
    }
  }

  return (
    <div className="relative flex h-full flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
      {showCloseButton && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Tutup sidebar"
          title="Tutup sidebar"
          className="absolute right-3 top-3 z-10 hidden rounded-full text-muted-foreground hover:text-sidebar-foreground lg:inline-flex"
        >
          <X className="size-5" />
        </Button>
      )}

      <Link
        href="/"
        className="mb-8 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-transform hover:scale-105"
        aria-label="Dashboard"
      >
        <Server className="size-5" />
      </Link>

      <nav className="space-y-1">
        {navigation.map(
          ({
            label,
            icon: Icon,
            href,
          }) => {
            const active =
              pathname === href

            return (
              <Button
                key={label}
                asChild
                variant="ghost"
                className={`w-full justify-start gap-3 transition-colors ${
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Link href={href}>
                  <Icon className="size-4 shrink-0" />

                  <span className="text-xs">
                    {label}
                  </span>

                  {label ===
                    "Peringatan" && (
                    <Badge className="ml-auto rounded-full bg-emerald-600 text-[10px] text-white hover:bg-emerald-600 dark:bg-emerald-500">
                      2
                    </Badge>
                  )}
                </Link>
              </Button>
            )
          },
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-sidebar-border pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="w-full justify-start gap-3 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          {theme === "light" ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}

          <span className="text-[11px] font-medium">
            {theme === "light"
              ? "Mode Gelap"
              : "Mode Terang"}
          </span>
        </Button>

        <div className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <Radio className="size-3.5 animate-pulse text-primary" />

          <span>ESP32 Monitor</span>
        </div>
      </div>
    </div>
  )
}