"use client"

import { type ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type AppShellProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="flex flex-col bg-slate-50/60 dark:bg-slate-950 min-h-screen">
        {/* Sticky App Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-background/90 backdrop-blur-md px-4 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="mr-1.5 h-4 shrink-0" />
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/" className="text-xs font-medium">
                    Monitoring
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold text-foreground">
                    {title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <span className="sm:hidden text-sm font-bold text-foreground truncate">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-6 space-y-6 min-w-0">
          {(title || description) && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-2 border-b border-border/40">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {title}
                </h1>
                {description && (
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {description}
                  </p>
                )}
              </div>
            </div>
          )}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
