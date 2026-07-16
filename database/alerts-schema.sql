-- Sistem peringatan suhu ruang server
-- Jalankan file ini satu kali melalui Supabase SQL Editor sebelum deploy kode API.

CREATE TABLE IF NOT EXISTS temperature_alerts (
  id SERIAL PRIMARY KEY,
  reading_id INTEGER REFERENCES sensor_readings(id) ON DELETE SET NULL,
  sensor_id VARCHAR(50) NOT NULL,
  level VARCHAR(20) NOT NULL CHECK (level IN ('Waspada', 'Bahaya')),
  status VARCHAR(20) NOT NULL DEFAULT 'Aktif'
    CHECK (status IN ('Aktif', 'Ditangani')),
  temperature NUMERIC(4, 2) NOT NULL,
  title VARCHAR(150) NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS temperature_alerts_sensor_time_idx
  ON temperature_alerts (sensor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS temperature_alerts_status_time_idx
  ON temperature_alerts (status, created_at DESC);

-- Hanya boleh ada satu peringatan aktif untuk satu sensor.
CREATE UNIQUE INDEX IF NOT EXISTS temperature_alerts_one_active_per_sensor_idx
  ON temperature_alerts (sensor_id)
  WHERE status = 'Aktif';