import PasswordForm from "./password-form"

export default function GantiPasswordPertamaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm font-medium text-blue-600">
          Monitoring Room
        </p>

        <h1 className="text-2xl font-semibold text-slate-900">
          Ganti Password Pertama
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Buat password baru sebelum menggunakan dashboard.
          Password baru harus dikonfirmasi melalui email.
        </p>

        <PasswordForm />
      </section>
    </main>
  )
}