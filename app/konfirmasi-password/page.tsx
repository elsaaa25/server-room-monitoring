import { Suspense } from "react"

import ConfirmationForm from "./confirmation-form"

export default function KonfirmasiPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6">
          <p>Memuat halaman konfirmasi...</p>
        </main>
      }
    >
      <ConfirmationForm />
    </Suspense>
  )
}