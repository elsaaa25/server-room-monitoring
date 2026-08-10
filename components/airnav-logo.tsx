import React from "react"

export function AirNavLogo({
  className = "h-9",
  showText = true,
}: {
  className?: string
  showText?: boolean
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Official AirNav Indonesia Logo */}
      <img
        src="/airnav-logo.png"
        alt="AirNav Indonesia"
        className="h-8.5 w-auto object-contain shrink-0 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:object-cover group-data-[collapsible=icon]:object-left"
      />

      {showText && (
        <div className="flex flex-col justify-center leading-tight group-data-[collapsible=icon]:hidden">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase truncate">
            Bandara Banyuwangi (BWX)
          </span>
        </div>
      )}
    </div>
  )
}
