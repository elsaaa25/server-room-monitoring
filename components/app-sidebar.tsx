"use client"

import * as React from "react"
import { useEffect, useState } from "react"
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
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const [theme, setTheme] = useState<"light" | "dark">("light")

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
    <Sidebar variant="floating" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Server className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold text-foreground">Server Room</span>
                  <span className="text-[10px] text-muted-foreground font-medium">Monitoring</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {navigation.map((item) => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={item.href}>
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} tooltip={theme === "light" ? "Mode Gelap" : "Mode Terang"}>
              {theme === "light" ? (
                <Moon className="size-4 shrink-0" />
              ) : (
                <Sun className="size-4 shrink-0" />
              )}
              <span>{theme === "light" ? "Mode Gelap" : "Mode Terang"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
          <Radio className="size-3.5 animate-pulse text-primary shrink-0" />
          <span className="truncate">AirNav Banyuwangi</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
