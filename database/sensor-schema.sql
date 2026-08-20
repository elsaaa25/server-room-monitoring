-- Tabel untuk menyimpan data pembacaan sensor suhu, tegangan, dan arus
CREATE TABLE IF NOT EXISTS sensor_readings (
  id          SERIAL PRIMARY KEY,
  sensor_id   VARCHAR(50)    NOT NULL,               -- Contoh: 'TEMP-L4', 'TEMP-L5'
  temperature NUMERIC(4, 2)  NOT NULL,               -- Suhu dalam Celcius (misal: 26.50)
  voltage     NUMERIC(5, 2),                         -- Tegangan AC dalam Volt (nullable - L5 tidak punya sensor tegangan)
  current     NUMERIC(6, 3),                         -- Arus AC dalam Ampere (nullable - hanya L4 yang punya ACS712)
  recorded_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()  -- Waktu perekaman otomatis dengan zona waktu
);

-- Index untuk mempercepat query berdasarkan ID sensor dan waktu (berguna untuk chart/history)
CREATE INDEX IF NOT EXISTS readings_sensor_time_idx
  ON sensor_readings (sensor_id, recorded_at DESC);

-- ============================================================
-- Jika tabel sensor_readings sudah ada tapi belum punya kolom
-- current (kolom ditambahkan belakangan), jalankan perintah
-- ALTER TABLE berikut satu kali melalui Supabase SQL Editor:
--
--   ALTER TABLE sensor_readings
--     ADD COLUMN IF NOT EXISTS current NUMERIC(6, 3);
--
-- ============================================================
