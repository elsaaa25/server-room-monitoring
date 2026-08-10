"use client"

import * as React from "react"
import Link from "next/link"
import { NavMain, type NavItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { AirNavLogo } from "@/components/airnav-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  House,
  Activity,
  History,
  Bell,
  Settings,
} from "lucide-react"

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: <House className="size-4 shrink-0" />,
  },
  {
    title: "Grafik Telemetri",
    url: "/grafik",
    icon: <Activity className="size-4 shrink-0" />,
  },
  {
    title: "Riwayat Data",
    url: "/riwayat",
    icon: <History className="size-4 shrink-0" />,
  },
  {
    title: "Log Peringatan",
    url: "/peringatan",
    icon: <Bell className="size-4 shrink-0" />,
  },
  {
    title: "Pengaturan Sistem",
    url: "/pengaturan",
    icon: <Settings className="size-4 shrink-0" />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" {...props}>
      <SidebarHeader className="h-16 px-3.5 pt-3 pb-2 flex items-center justify-between group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
        <Link href="/" className="flex items-center gap-2 p-0 transition-opacity hover:opacity-90 min-w-0 overflow-hidden">
          <AirNavLogo className="h-8" showText={true} />
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-0 py-3">
        <NavMain items={navItems} />
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
