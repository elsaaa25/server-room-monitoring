"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type UnderlineTabItem = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

export function UnderlineTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  layoutId = "tabs-05-underline",
}: {
  tabs: UnderlineTabItem[]
  activeTab: string
  onTabChange: (id: string) => void
  className?: string
  layoutId?: string
}) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className={cn("w-full", className)}>
      <TabsList
        variant="line"
        className="flex w-full bg-transparent p-0! rounded-none h-auto! gap-1 justify-start! no-scrollbar overflow-x-auto"
        onMouseLeave={() => setHoveredTab(null)}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isHovered = hoveredTab === tab.id

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onMouseEnter={() => setHoveredTab(tab.id)}
              className={cn(
                "relative flex min-w-0 flex-1 items-center justify-center cursor-pointer text-sm font-bold transition-colors outline-none whitespace-nowrap bg-transparent shadow-none after:hidden border-none p-0 pb-1.5",
                isActive ? "text-[#005A9C] dark:text-blue-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              <span className="relative z-10 flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-2.5">
                {isHovered && (
                  <motion.span
                    layoutId={`${layoutId}-hover`}
                    className="absolute inset-0 bg-slate-100/90 dark:bg-slate-800/70 rounded-xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {Icon && <Icon className="size-4.5 relative z-10 shrink-0 text-[#005A9C] dark:text-blue-400" />}
                <span className="relative z-10 tracking-tight">{tab.label}</span>
              </span>

              {isActive && (
                <motion.div
                  layoutId={`${layoutId}-indicator`}
                  className="absolute bottom-0 left-1 right-1 h-[3px] bg-[#005A9C] dark:bg-blue-400 rounded-full z-20 shadow-sm"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

export default UnderlineTabs
