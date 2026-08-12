"use client"

import dynamic from "next/dynamic"

const ProfilePage = dynamic(() => import("@/components/profile-page").then(module => module.ProfilePage), { ssr: false })

export default function Page() { return <ProfilePage /> }
