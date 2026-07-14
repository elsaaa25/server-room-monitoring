"use client"

import dynamic from "next/dynamic"

const HistoryPage = dynamic(() => import("@/components/history-page").then(module => module.HistoryPage), { ssr: false })

export default function Page() { return <HistoryPage /> }
