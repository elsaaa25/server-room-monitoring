"use client"

import { useState } from "react"

type Status = "idle" | "loading" | "success" | "error"

export default function PasswordForm() {
  const [currentPassword, setCurrentPassword] =
    useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] =
    useState("")

  const [status, setStatus] =
    useState<Status>("idle")

  const [message, setMessage] = useState("")

  async function submitPassword(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (status === "loading") {
      return
    }

    setStatus("loading")
    setMessage("Mengirim permintaan perubahan password...")

    try {
      const response = await fetch(
        "/api/account/change-first-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Penggantian password gagal.",
        )
      }

      setStatus("success")
      setMessage(result.message)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      setStatus("error")

      setMessage(
        error instanceof Error
          ? error.message
          : "Penggantian password gagal.",
      )
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <h2 className="font-semibold text-green-900">
          Periksa email Anda
        </h2>

        <p className="mt-2 text-sm leading-6 text-green-800">
          {message}
        </p>

        <p className="mt-2 text-sm leading-6 text-green-800">
          Password baru belum aktif sampai tautan konfirmasi
          dibuka.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={submitPassword}
      className="mt-6 space-y-4"
    >
      <div>
        <label
          htmlFor="currentPassword"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Password sementara
        </label>

        <input
          id="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={event =>
            setCurrentPassword(event.target.value)
          }
          className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div>
        <label
          htmlFor="newPassword"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Password baru
        </label>

        <input
          id="newPassword"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={newPassword}
          onChange={event =>
            setNewPassword(event.target.value)
          }
          className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Minimal 12 karakter, huruf besar, huruf kecil,
          angka, dan karakter khusus.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Konfirmasi password baru
        </label>

        <input
          id="confirmPassword"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={event =>
            setConfirmPassword(event.target.value)
          }
          className="w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {message && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "loading"
          ? "Memproses..."
          : "Kirim Konfirmasi ke Email"}
      </button>
    </form>
  )
}