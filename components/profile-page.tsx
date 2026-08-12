"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, Save, UserRound, X } from "lucide-react"

type ProfileData = {
  id: string
  name: string
  email: string
  role: string
}

type ProfileApiResponse = {
  success?: boolean
  message?: string
  data?: ProfileData
}

export function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      try {
        const response = await fetch("/api/account/profile")
        const result = (await response.json()) as ProfileApiResponse

        if (active) {
          if (response.ok && result.success && result.data) {
            setProfile(result.data)
            setName(result.data.name)
          } else {
            setFeedback({
              type: "error",
              message: result.message || "Gagal mengambil data profil.",
            })
          }
        }
      } catch (err) {
        if (active) {
          setFeedback({
            type: "error",
            message: "Koneksi terputus. Gagal mengambil profil.",
          })
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const result = (await response.json()) as ProfileApiResponse

      if (response.ok && result.success && result.data) {
        setProfile(result.data)
        setName(result.data.name)
        setFeedback({
          type: "success",
          message: result.message || "Profil berhasil disimpan.",
        })
        router.refresh()
      } else {
        setFeedback({
          type: "error",
          message: result.message || "Gagal memperbarui profil.",
        })
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: "Gagal terhubung ke server untuk menyimpan profil.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell
      title="Profil Pengguna"
      description="Kelola informasi akun Anda di platform monitoring."
    >
      {feedback && (
        <div
          className={`flex items-start justify-between rounded-xl border p-4 text-xs font-semibold ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-950/60 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-950/60 dark:bg-rose-950/20 dark:text-rose-300"
          }`}
        >
          <div className="flex-1 pr-4">{feedback.message}</div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground focus-visible:outline-none"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span>Memuat informasi profil...</span>
          </div>
        </div>
      ) : profile ? (
        <div className="max-w-2xl">
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="size-5" />
                </div>
                <div>
                  <CardTitle>Informasi Profil</CardTitle>
                  <CardDescription className="mt-1">
                    Detail profil dan hak akses pengguna Anda.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-foreground">
                    Alamat Email (Akun)
                  </label>
                  <div className="flex h-10 w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground items-center gap-2 select-all">
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    <span>{profile.email}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Email akun tidak dapat diubah secara langsung dari sini.
                  </span>
                </div>

                <div className="space-y-2">
                  <label htmlFor="role" className="block text-sm font-semibold text-foreground">
                    Hak Akses System
                  </label>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        profile.role === "ADMIN"
                          ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                          : "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      }
                    >
                      {profile.role}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-semibold text-foreground">
                    Nama Pengguna
                  </label>
                  <div className="relative">
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Masukkan nama lengkap Anda"
                      required
                      minLength={2}
                      maxLength={100}
                      className="rounded-xl pl-9"
                    />
                    <UserRound className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Nama yang akan ditampilkan pada riwayat aktivitas & laporan.
                  </span>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/40">
                  <Button
                    type="submit"
                    disabled={saving || name.trim() === profile.name}
                    className="rounded-xl flex items-center gap-2 font-semibold"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    <span>Simpan Perubahan</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center text-sm text-rose-600 font-semibold p-8">
          Pengguna tidak ditemukan atau sesi Anda telah berakhir.
        </div>
      )}
    </AppShell>
  )
}
