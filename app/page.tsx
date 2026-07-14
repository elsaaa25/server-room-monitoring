"use client"

import dynamic from "next/dynamic"

const Dashboard = dynamic(
  () => import("@/components/dashboard").then((module) => module.Dashboard),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center text-sm text-slate-500">
        Memuat dashboard monitoring…
      </main>
    ),
  },
)

export default function Home() { return <Dashboard /> }
