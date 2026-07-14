# Panduan Deployment: Supabase & Vercel

Dokumen ini berisi panduan langkah-demi-langkah untuk menyiapkan database PostgreSQL di **Supabase** dan meluncurkan (*deploy*) aplikasi Next.js ke **Vercel** secara gratis.

---

## Langkah 1: Setup Database PostgreSQL di Supabase

1. **Daftar/Login ke Supabase:**
   * Kunjungi [https://supabase.com](https://supabase.com) dan masuk menggunakan akun GitHub Anda.
2. **Buat Project Baru:**
   * Klik tombol **New Project**.
   * Pilih Organisasi Anda.
   * Isi **Name** (misal: `server-room-monitor-db`).
   * Isi **Database Password** (catat password ini baik-baik!).
   * Pilih **Region** terdekat (misal: `Singapore` atau `East Asia` agar koneksi lebih cepat).
   * Klik **Create New Project** dan tunggu 1-2 menit hingga database selesai disiapkan.
3. **Jalankan SQL Schema:**
   * Di dashboard project Supabase Anda, buka menu **SQL Editor** di sidebar kiri (ikon lembaran kode `SQL`).
   * Klik **New Query** (blank query).
   * Salin seluruh isi file skema autentikasi Anda dari proyek lokal ([auth-schema.sql](file:///D:/Dokumen/New%20project/server-room-monitoring/database/auth-schema.sql)) ke editor Supabase, lalu klik **Run** (tombol hijau di kanan bawah).
   * Buat query baru lagi, salin isi skema sensor ([sensor-schema.sql](file:///D:/Dokumen/New%20project/server-room-monitoring/database/sensor-schema.sql)), lalu klik **Run**.
4. **Dapatkan Connection String:**
   * Buka menu **Project Settings** (ikon gerigi di kiri bawah) $\rightarrow$ **Database**.
   * Gulir ke bawah ke bagian **Connection String**.
   * Pilih tab **URI**.
   * Salin connection string tersebut. Formatnya akan seperti:
     `postgresql://postgres.[username]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
     *(Catatan: Ganti `[password]` dengan password database yang Anda buat tadi. Dan pastikan port 6543 (Pgbouncer/Pooler) digunakan agar aman untuk serverless Vercel).*

---

## Langkah 2: Unggah Kode ke GitHub

1. Buat repositori baru di [GitHub](https://github.com) dengan nama `server-room-monitoring` (setel sebagai *Private* jika Anda tidak ingin kode Anda dilihat publik).
2. Di komputer lokal Anda, buka terminal di folder proyek dan jalankan perintah:
   ```bash
   git init
   git add .
   git commit -m "Initial commit dengan integrasi database Supabase"
   git branch -M main
   git remote add origin https://github.com/USERNAME-ANDA/server-room-monitoring.git
   git push -u origin main
   ```

---

## Langkah 3: Deploy ke Vercel

1. **Daftar/Login ke Vercel:**
   * Kunjungi [https://vercel.com](https://vercel.com) dan login menggunakan akun GitHub Anda.
2. **Import Repositori:**
   * Klik **Add New** $\rightarrow$ **Project**.
   * Cari repositori `server-room-monitoring` yang baru saja Anda unggah ke GitHub, lalu klik **Import**.
3. **Konfigurasi Environment Variables:**
   * Di bagian **Environment Variables**, tambahkan variabel berikut satu per satu:
     
     * `DATABASE_URL`: Isi dengan connection string URI Supabase yang telah disalin di Langkah 1 (contoh: `postgresql://postgres.xxxx:[password]@...pooler.supabase.com:6543/postgres?pgbouncer=true`).
     * `AUTH_SECRET`: Gunakan nilai acak yang aman. Anda bisa menyalin nilai `AUTH_SECRET` dari file [.env.local](file:///D:/Dokumen/New%20project/server-room-monitoring/.env.local) lokal Anda.
     * `SENSOR_API_KEY`: Buat kunci rahasia acak Anda sendiri (misalnya: `KunciRahasiaSensor123!`). Kunci ini yang nantinya dimasukkan ke dalam kode ESP32 agar ESP32 diizinkan mengirimkan data.
     
4. **Klik Deploy:**
   * Klik tombol **Deploy** dan tunggu proses build selesai (sekitar 1-2 menit).
   * Vercel akan memberikan domain publik gratis untuk aplikasi Anda (contoh: `https://server-room-monitoring-three.vercel.app`).
   * Selamat! Aplikasi Anda sekarang sudah bisa diakses dari HP, laptop, atau komputer manapun di internet!

---

## Langkah 4: Membuat User Akun untuk Login Pertama

Aplikasi Anda menggunakan halaman login NextAuth. Untuk membuat akun operator/admin pertama agar bisa masuk ke dashboard:
1. Di komputer lokal Anda, jalankan skrip pembuatan user yang sudah disediakan di folder proyek dengan terminal:
   ```bash
   # Pastikan Anda telah mengganti DATABASE_URL di file .env.local dengan connection string Supabase terlebih dahulu!
   npm run user:create
   ```
2. Ikuti instruksi di layar terminal untuk mengisi email, nama, password, dan role (`ADMIN` atau `OPERATOR`).
3. Akun yang terbuat akan langsung masuk ke database Supabase dan bisa Anda gunakan untuk login di website yang sudah online di Vercel.
