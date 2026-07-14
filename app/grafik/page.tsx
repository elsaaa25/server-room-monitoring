"use client"

import dynamic from "next/dynamic"

const GraphPage = dynamic(() => import("@/components/graph-page").then(module => module.GraphPage), { ssr: false })

export default function Page() { return <GraphPage /> }
