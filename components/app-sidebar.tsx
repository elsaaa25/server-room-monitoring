"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bell, History, House, Radio, Server, Settings, Sun, Moon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const navigation = [
  { label: "Dashboard", icon: House, href: "/" },
  { label: "Grafik", icon: Activity, href: "/grafik" },
  { label: "Riwayat", icon: History, href: "/riwayat" },
  { label: "Peringatan", icon: Bell, href: "/peringatan" },
  { label: "Pengaturan", icon: Settings, href: "/pengaturan" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<"light" | "dark">("light")

  // Sinkronisasi tema awal dengan kelas HTML
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "dark" : "light")
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4">
      {/* Logo Brand */}
      <Link 
        href="/" 
        className="mb-8 flex items-center justify-center size-11 rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-transform hover:scale-105" 
        aria-label="Dashboard"
      >
        <Server className="size-5" />
      </Link>
      
      {/* Menu Navigasi */}
      <nav className="space-y-1">
        {navigation.map(({ label, icon: Icon, href }) => {
          const active = pathname === href
          return (
            <Button 
              key={label} 
              asChild 
              variant="ghost" 
              className={`w-full justify-start gap-3 transition-colors ${
                active 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" 
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <Link href={href}>
                <Icon className="size-4 shrink-0" />
                <span className="text-xs">{label}</span>
                {label === "Peringatan" && (
                  <Badge className="ml-auto rounded-full bg-emerald-600 dark:bg-emerald-500 text-[10px] text-white">2</Badge>
                )}
              </Link>
            </Button>
          )
        })}
      </nav>

      {/* Bagian Bawah: Sakelar Tema & Status */}
      <div className="mt-auto pt-4 border-t border-sidebar-border flex flex-col gap-3">
        {/* Tombol Toggle Tema */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleTheme} 
          className="w-full justify-start gap-3 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          <span className="text-[11px] font-medium">{theme === "light" ? "Mode Gelap" : "Mode Terang"}</span>
        </Button>

        {/* Status Perangkat */}
        <div className="flex items-center gap-2 px-3 text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
          <Radio className="size-3.5 text-primary animate-pulse" />
          <span>ESP32 Monitor</span>
        </div>
      </div>
    </div>
  )
}