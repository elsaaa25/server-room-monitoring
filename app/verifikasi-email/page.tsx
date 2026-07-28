import { Suspense } from "react"

import VerificationForm from "./verification-form"

export default function VerifikasiEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6">
          <p>Memuat halaman verifikasi...</p>
        </main>
      }
    >
      <VerificationForm />
    </Suspense>
  )
}