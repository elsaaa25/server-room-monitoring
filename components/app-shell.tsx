"use client"

import { type ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-sm">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {description && (
            <div className="hidden min-w-0 md:block ml-2 border-l border-border pl-3">
              <p className="text-xs text-muted-foreground truncate">
                {description}
              </p>
            </div>
          )}

          {actions && (
            <div className="ml-auto flex items-center gap-2">
              {actions}
            </div>
          )}
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
