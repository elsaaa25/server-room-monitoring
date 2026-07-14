# Product Requirements Document

## Server Room Monitoring Dashboard

**Versi:** 1.0  
**Status:** Draft MVP  
**Platform:** Web responsif  
**Bahasa antarmuka:** Indonesia

## 1. Ringkasan Produk

Server Room Monitoring Dashboard adalah aplikasi web untuk memantau suhu ruang server secara hampir real-time. ESP32 membaca sensor suhu, mengirim data melalui MQTT, lalu layanan subscriber menyimpan data ke PostgreSQL. Dashboard Next.js mengambil data terbaru dari API setiap 4 detik.

Produk membantu operator mengetahui kondisi ruangan, melihat tren suhu, mendeteksi sensor yang tidak aktif, serta menerima peringatan ketika suhu melewati batas aman.

## 2. Tujuan

- Menampilkan suhu ruang server secara jelas dan cepat.
- Memperbarui data dashboard otomatis setiap 3–5 detik tanpa reload halaman.
- Menyediakan histori dan grafik suhu untuk analisis.
- Memberikan peringatan saat suhu masuk status waspada atau bahaya.
- Menampilkan status koneksi sensor dan komponen sistem.
- Menyimpan data pengukuran secara konsisten di PostgreSQL.

## 3. Ruang Lingkup MVP

### Termasuk

- Satu ruang server.
- Dukungan satu atau lebih ESP32 dengan `sensor_id` unik.
- Monitoring suhu dalam °C.
- Status suhu normal, waspada, dan bahaya.
- Grafik periode 1 jam, 6 jam, dan 24 jam.
- Lima data pengukuran terakhir.
- Ringkasan suhu tertinggi, terendah, dan rata-rata hari ini.
- Daftar peringatan terbaru.
- Status sensor online atau offline.
- Tampilan desktop, tablet, dan mobile.
- Data demo ketika database belum dikonfigurasi pada lingkungan development.

### Belum termasuk

- Kontrol AC atau kipas secara otomatis.
- Notifikasi WhatsApp, Telegram, SMS, atau email.
- Multi-tenant dan banyak lokasi.
- Manajemen pengguna tingkat lanjut.
- Monitoring kelembapan, asap, pintu, atau listrik.
- Aplikasi mobile native.

## 4. Pengguna Utama

### Operator IT

Memantau kondisi ruang server dan menindaklanjuti peringatan.

### Administrator

Mengatur sensor, ambang suhu, koneksi MQTT, dan akun pengguna pada pengembangan berikutnya.

## 5. Alur Sistem

1. ESP32 membaca suhu dari sensor.
2. ESP32 mengirim payload JSON ke MQTT broker.
3. MQTT subscriber memvalidasi payload.
4. Data valid disimpan ke PostgreSQL.
5. Sistem membuat catatan peringatan bila suhu melewati batas.
6. Next.js API membaca data terbaru dan histori.
7. Browser mengambil data API setiap 4 detik.
8. Dashboard memperbarui kartu, grafik, tabel, dan peringatan tanpa reload.

## 6. Kebutuhan Fungsional

### FR-01 — Ringkasan suhu terkini

Dashboard harus menampilkan:

- Suhu terbaru dalam °C dengan satu angka desimal.
- Status ruangan.
- Status sensor.
- Waktu pembaruan terakhir dalam WIB.

### FR-02 — Klasifikasi suhu

Aturan bawaan MVP:

| Status | Kondisi |
|---|---|
| Normal | Suhu ≤ 27°C |
| Waspada | Suhu > 27°C dan < 30°C |
| Bahaya | Suhu ≥ 30°C |

### FR-03 — Grafik suhu

- Menampilkan suhu berdasarkan waktu.
- Pilihan periode: 1 jam, 6 jam, dan 24 jam.
- Menampilkan garis batas 27°C dan 30°C.
- Menampilkan waktu dan suhu saat titik grafik disorot.
- Grafik tetap terbaca pada perangkat mobile.

### FR-04 — Data terakhir

- Menampilkan minimal lima pengukuran terakhir.
- Kolom: waktu, suhu, status, dan keterangan.
- Data terbaru berada di baris pertama.

### FR-05 — Ringkasan harian

Menampilkan suhu tertinggi, terendah, dan rata-rata sejak pukul 00.00 WIB.

### FR-06 — Peringatan

- Membuat peringatan ketika suhu memasuki status waspada atau bahaya.
- Menampilkan level, judul, nilai suhu, serta waktu kejadian.
- Menghindari pembuatan peringatan identik pada setiap payload. Peringatan baru dibuat saat status berubah atau setelah interval pengingat yang ditentukan.
- Mencatat kejadian ketika suhu kembali normal.

### FR-07 — Status sensor

- Sensor dinyatakan online bila data terakhir diterima dalam 30 detik.
- Sensor dinyatakan offline bila tidak ada data baru selama lebih dari 30 detik.
- Batas waktu harus dapat dikonfigurasi melalui environment variable.

### FR-08 — Pembaruan otomatis

- Browser memanggil endpoint dashboard setiap 4 detik.
- Polling tidak boleh membuat halaman reload.
- Jika permintaan gagal, data terakhir tetap ditampilkan.
- Dashboard menampilkan indikator gangguan koneksi dan mencoba kembali otomatis.

### FR-09 — Validasi payload MQTT

Contoh payload:

```json
{
  "sensor_id": "esp32-01",
  "temperature": 26.8,
  "timestamp": "2026-07-03T07:32:01.000Z"
}
```

Ketentuan:

- `sensor_id` wajib berupa string yang dikenal sistem.
- `temperature` wajib berupa angka dalam rentang -50 sampai 100.
- `timestamp` menggunakan ISO 8601 dan bersifat opsional.
- Server memakai waktu penerimaan jika `timestamp` tidak tersedia.
- Payload tidak valid ditolak dan dicatat pada log tanpa menghentikan subscriber.

## 7. Halaman dan Navigasi

### Dashboard

Berisi kartu ringkasan, grafik, batas suhu, peringatan terbaru, data terakhir, ringkasan harian, dan status sistem.

### Grafik

Halaman grafik historis dengan pilihan rentang waktu yang lebih panjang. Dapat dikerjakan setelah MVP dashboard.

### Riwayat

Tabel histori dengan filter tanggal, status, dan sensor. Dapat dikerjakan setelah MVP dashboard.

### Peringatan

Daftar seluruh kejadian suhu beserta status penanganannya. Dapat dikerjakan setelah MVP dashboard.

### Pengaturan

Pengaturan ambang suhu dan sensor. Dapat dikerjakan setelah MVP dashboard.

## 8. Spesifikasi UI/UX

- Menggunakan Next.js App Router dan komponen Shadcn UI.
- Visual dominan putih, hijau, abu-abu muda, dengan aksen oranye dan merah.
- Sidebar pada desktop dan drawer pada mobile.
- Kartu menggunakan border tipis, sudut membulat, dan bayangan ringan.
- Hijau untuk normal, oranye untuk waspada, merah untuk bahaya.
- Status tidak boleh dibedakan hanya berdasarkan warna; selalu sertakan teks atau ikon.
- Tampilkan skeleton atau indikator pemuatan pada pembukaan pertama.
- Format waktu menggunakan zona `Asia/Bangkok`/WIB (UTC+7).

## 9. Arsitektur Teknis

### Frontend dan API

- Next.js dengan TypeScript dan App Router.
- Shadcn UI untuk komponen antarmuka.
- Recharts untuk grafik.
- Route Handler Next.js untuk endpoint dashboard.
- Polling client setiap 4 detik menggunakan `fetch` atau SWR.

### Data dan integrasi

- PostgreSQL sebagai penyimpanan utama.
- MQTT broker sebagai jalur komunikasi ESP32.
- Worker Node.js terpisah sebagai MQTT subscriber.
- Zod untuk validasi payload.
- Koneksi database menggunakan Prisma atau driver `pg`.

### Alur data

```text
ESP32 + sensor → MQTT broker → subscriber worker → PostgreSQL
                                                    ↓
Browser ← polling 4 detik ← Next.js API route ← query database
```

## 10. Model Data Minimum

### `sensors`

- `id`
- `sensor_code` unik
- `name`
- `location`
- `is_active`
- `created_at`

### `temperature_readings`

- `id`
- `sensor_id`
- `temperature`
- `recorded_at`
- `received_at`

Indeks diperlukan pada `(sensor_id, recorded_at DESC)` dan `recorded_at DESC`.

### `alerts`

- `id`
- `sensor_id`
- `reading_id`
- `level`
- `title`
- `detail`
- `acknowledged_at`, nullable
- `created_at`

## 11. API Minimum

### `GET /api/dashboard?hours=1`

Mengembalikan suhu terbaru, status sensor, data grafik, lima pengukuran terakhir, ringkasan hari ini, dan peringatan terbaru dalam satu respons.

### `GET /api/readings`

Mengembalikan histori dengan pagination serta filter tanggal, status, dan sensor. Endpoint ini dapat dikerjakan setelah dashboard MVP.

### Format respons error

```json
{
  "message": "Gagal membaca data monitoring",
  "code": "DASHBOARD_READ_FAILED"
}
```

## 12. Kebutuhan Nonfungsional

- Waktu respons API target kurang dari 500 ms pada penggunaan normal.
- Dashboard pertama kali tampil dalam target kurang dari 3 detik pada koneksi normal.
- Query grafik maksimum dibatasi dan dapat menggunakan agregasi untuk data besar.
- Kredensial database dan MQTT hanya disimpan dalam environment variable.
- Endpoint tidak menampilkan stack trace atau kredensial kepada browser.
- Subscriber harus reconnect otomatis setelah koneksi MQTT terputus.
- Penyimpanan data tidak boleh gagal hanya karena satu payload rusak.
- UI memenuhi prinsip aksesibilitas dasar: keyboard, label tombol, dan kontras warna.

## 13. Kriteria Penerimaan MVP

MVP dianggap selesai apabila:

1. ESP32 dapat mengirim payload MQTT yang valid.
2. Subscriber menyimpan payload valid ke PostgreSQL.
3. Payload tidak valid ditolak tanpa menghentikan worker.
4. Dashboard menampilkan data terbaru dari database.
5. Data diperbarui otomatis setiap 4 detik tanpa reload.
6. Grafik dapat berganti antara periode 1, 6, dan 24 jam.
7. Status suhu mengikuti aturan normal, waspada, dan bahaya.
8. Sensor berubah menjadi offline setelah batas waktu terlewati.
9. Peringatan muncul saat status berubah ke waspada atau bahaya.
10. Gangguan API tidak menghapus data terakhir dari layar.
11. Dashboard berfungsi baik pada desktop dan mobile.
12. Waktu ditampilkan konsisten dalam WIB.

## 14. Tahapan Implementasi

### Fase 1 — Fondasi

- Inisialisasi Next.js dan Shadcn UI.
- Menyusun layout dashboard menggunakan data mock.
- Menyiapkan PostgreSQL dan migration.

### Fase 2 — Integrasi sensor

- Menyiapkan MQTT broker dan topic.
- Membuat subscriber dan validasi payload.
- Menyimpan data pembacaan serta peringatan.

### Fase 3 — Data nyata

- Membuat API dashboard.
- Menghubungkan UI dengan polling 4 detik.
- Menangani loading, offline, dan error.

### Fase 4 — Verifikasi

- Menguji status batas suhu.
- Menguji reconnect MQTT dan sensor offline.
- Menguji tampilan desktop/mobile.
- Menguji performa query dan polling.

## 15. Pengembangan Lanjutan

- Notifikasi WhatsApp, Telegram, dan email.
- Pengaturan ambang suhu melalui UI.
- Autentikasi dan role operator/admin.
- Banyak ruangan dan lokasi.
- Monitoring kelembapan, asap, pintu, dan daya listrik.
- Acknowledgement serta catatan penanganan alarm.
- Export CSV/PDF dan laporan berkala.
- WebSocket atau Server-Sent Events bila kebutuhan real-time meningkat.

## 16. Asumsi dan Keputusan MVP

- Polling dipilih karena sederhana, stabil, dan sesuai interval 3–5 detik.
- Interval bawaan ditetapkan 4 detik.
- Satu sumber waktu utama digunakan di server dan ditampilkan sebagai WIB.
- MQTT hanya diterima oleh worker backend; browser tidak terhubung langsung ke broker.
- Ambang suhu awal mengikuti desain referensi dan nantinya dapat dibuat configurable.
