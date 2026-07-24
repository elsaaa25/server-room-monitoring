"use client"

import {
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { Menu } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type AppShellProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

const SIDEBAR_STORAGE_KEY =
  "monitoring-sidebar-open"

export function AppShell({
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] =
    useState(true)

  useEffect(() => {
    const storedValue = localStorage.getItem(
      SIDEBAR_STORAGE_KEY,
    )

    if (storedValue !== null) {
      setSidebarOpen(storedValue === "true")
    }
  }, [])

  const openSidebar = () => {
    setSidebarOpen(true)

    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      "true",
    )
  }

  const closeSidebar = () => {
    setSidebarOpen(false)

    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      "false",
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      {sidebarOpen && (
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block z-10">
          <AppSidebar
            showCloseButton
            onClose={closeSidebar}
          />
        </aside>
      )}

      <main className="min-w-0 flex-1 p-6 md:p-8 transition-all duration-300">
        <header className="flex min-h-20 items-center gap-3">
          {/* Menu untuk tampilan HP */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="shrink-0 lg:hidden"
                aria-label="Buka navigasi"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-56 p-0"
            >
              <SheetTitle className="sr-only">
                Navigasi
              </SheetTitle>

              <AppSidebar />
            </SheetContent>
          </Sheet>

          {/* Menu desktop saat sidebar ditutup */}
          {!sidebarOpen && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={openSidebar}
              className="hidden shrink-0 rounded-md text-primary shadow-sm lg:inline-flex"
              aria-label="Tampilkan sidebar"
              title="Tampilkan sidebar"
            >
              <Menu className="size-5" />
            </Button>
          )}

          {/* Judul halaman */}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
              {title}
            </h1>

            {description && (
              <p className="hidden text-sm text-muted-foreground sm:block">
                {description}
              </p>
            )}
          </div>

          {/* Tombol sisi kanan header */}
          {actions && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {actions}
            </div>
          )}
        </header>

        {children}
      </main>
    </div>
  )
}
