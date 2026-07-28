"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { signOut } from "next-auth/react"
import { useState } from "react"

type ConfirmationStatus =
  | "idle"
  | "loading"
  | "success"
  | "error"

export default function ConfirmationForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [status, setStatus] =
    useState<ConfirmationStatus>("idle")

  const [message, setMessage] = useState(
    token
      ? "Klik tombol di bawah untuk mengaktifkan password baru."
      : "Token konfirmasi tidak ditemukan.",
  )

  async function confirmPassword() {
    if (
      !token ||
      status === "loading" ||
      status === "success"
    ) {
      return
    }

    setStatus("loading")
    setMessage("Sedang mengaktifkan password baru...")

    try {
      const response = await fetch(
        "/api/account/confirm-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Konfirmasi password gagal.",
        )
      }

      // Menghapus sesi yang masih memakai password sementara.
      await signOut({
        redirect: false,
      })

      setStatus("success")
      setMessage(result.message)
    } catch (error) {
      setStatus("error")

      setMessage(
        error instanceof Error
          ? error.message
          : "Konfirmasi password gagal.",
      )
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm font-medium text-blue-600">
          Monitoring Room
        </p>

        <h1 className="text-2xl font-semibold text-slate-900">
          Konfirmasi Password Baru
        </h1>

        <p
          className={`mt-3 text-sm leading-6 ${
            status === "error"
              ? "text-red-700"
              : status === "success"
                ? "text-green-700"
                : "text-slate-600"
          }`}
        >
          {message}
        </p>

        {status === "success" ? (
          <Link
            href="/login"
            className="mt-6 block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            Login dengan password baru
          </Link>
        ) : (
          <button
            type="button"
            onClick={confirmPassword}
            disabled={
              !token ||
              status === "loading"
            }
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading"
              ? "Mengonfirmasi..."
              : "Konfirmasi Password Baru"}
          </button>
        )}
      </section>
    </main>
  )
}