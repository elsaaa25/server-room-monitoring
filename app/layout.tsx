import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"

import { AlertNotificationCenter } from "@/components/alert-notification-center"

import "./globals.css"

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Server Room Monitoring",
  description:
    "Dashboard pemantauan suhu ruang server",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistMono.variable} antialiased`}
      >
        <AlertNotificationCenter />
        {children}
      </body>
    </html>
  )
}