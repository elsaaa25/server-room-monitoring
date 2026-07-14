"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bell, History, House, Radio, Server, Settings } from "lucide-react"
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
  return <div className="flex h-full flex-col bg-white p-4">
    <Link href="/" className="mb-10 grid size-12 place-items-center rounded-2xl bg-[#005a9c] text-white shadow-lg shadow-blue-200" aria-label="Dashboard"><Server /></Link>
    <nav className="space-y-2">{navigation.map(({ label, icon: Icon, href }) => {
      const active = pathname === href
      return <Button key={label} asChild variant="ghost" className={`w-full justify-start gap-3 ${active ? "bg-blue-50 text-[#005a9c] hover:bg-blue-100" : "text-slate-500"}`}>
        <Link href={href}><Icon className="size-5" />{label}{label === "Peringatan" && <Badge className="ml-auto rounded-full bg-emerald-600">2</Badge>}</Link>
      </Button>
    })}</nav>
    <div className="mt-auto flex gap-2 px-3 text-xs text-slate-400"><Radio className="size-4 text-[#005a9c]" />ESP32 Monitor</div>
  </div>
}
