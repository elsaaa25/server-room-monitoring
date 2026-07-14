"use client"

import dynamic from "next/dynamic"

const AlertsPage = dynamic(() => import("@/components/alerts-page").then(module => module.AlertsPage), { ssr: false })

export default function Page() { return <AlertsPage /> }
