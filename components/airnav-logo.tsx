import React from "react"

export function AirNavLogo({
  className = "h-9.5",
  showText = true,
}: {
  className?: string
  showText?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon Logo Circle */}
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto aspect-square shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="50" r="48" fill="#005A9C" />
        {/* Red swoosh arrow / plane */}
        <path
          d="M20 70 C 40 40, 65 30, 85 18 L 78 40 C 60 48, 40 60, 20 70 Z"
          fill="#E31B23"
        />
        {/* White dynamic swoosh curve */}
        <path
          d="M12 78 C 30 55, 55 42, 88 22 C 65 40, 38 60, 12 78 Z"
          fill="#FFFFFF"
        />
        {/* AirNav text inside circle */}
        <text
          x="50"
          y="82"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="14"
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          AirNav
        </text>
      </svg>

      {showText && (
        <div className="flex flex-col justify-center leading-tight group-data-[collapsible=icon]:hidden">
          <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
            AirNav <span className="text-[#005A9C] dark:text-blue-400">Indonesia</span>
          </span>
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase truncate">
            Bandara Banyuwangi (BWX)
          </span>
        </div>
      )}
    </div>
  )
}
