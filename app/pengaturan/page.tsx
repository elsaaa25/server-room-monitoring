"use client"

import dynamic from "next/dynamic"

const SettingsPage = dynamic(() => import("@/components/settings-page").then(module => module.SettingsPage), { ssr: false })

export default function Page() { return <SettingsPage /> }
