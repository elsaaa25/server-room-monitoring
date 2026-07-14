-- Tabel untuk menyimpan data pembacaan sensor suhu dan tegangan
CREATE TABLE IF NOT EXISTS sensor_readings (
  id SERIAL PRIMARY KEY,
  sensor_id VARCHAR(50) NOT NULL, -- Contoh: 'esp32-lantai4', 'esp32-lantai5'
  temperature NUMERIC(4, 2) NOT NULL, -- Menyimpan suhu (misal: 26.50)
  voltage NUMERIC(5, 2), -- Menyimpan tegangan (misal: 220.50). Nullable karena lantai 5 hanya memantau suhu.
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Waktu perekaman otomatis dengan zona waktu
);

-- Index untuk mempercepat query berdasarkan ID sensor dan waktu (berguna untuk chart/history)
CREATE INDEX IF NOT EXISTS readings_sensor_time_idx ON sensor_readings (sensor_id, recorded_at DESC);
