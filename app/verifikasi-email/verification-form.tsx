"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"

type VerificationStatus = "idle" | "loading" | "success" | "error"

export default function VerificationForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<VerificationStatus>("idle")
  const [message, setMessage] = useState(
    token
      ? "Klik tombol di bawah untuk memverifikasi alamat email admin."
      : "Token verifikasi tidak ditemukan.",
  )

  async function verifyEmail() {
    if (!token || status === "loading") {
      return
    }

    setStatus("loading")
    setMessage("Sedang memverifikasi email...")

    try {
      const response = await fetch("/api/account/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? "Verifikasi email gagal.")
      }

      setStatus("success")
      setMessage(result.message)
    } catch (error) {
      setStatus("error")
      setMessage(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat memverifikasi email.",
      )
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-blue-600">
            Monitoring Room
          </p>

          <h1 className="text-2xl font-semibold text-slate-900">
            Verifikasi Email Admin
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {message}
          </p>
        </div>

        {status === "success" ? (
          <a
            href="/login"
            className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            Ke halaman login
          </a>
        ) : (
          <button
            type="button"
            onClick={verifyEmail}
            disabled={!token || status === "loading"}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading"
              ? "Memverifikasi..."
              : "Verifikasi Email"}
          </button>
        )}
      </section>
    </main>
  )
}