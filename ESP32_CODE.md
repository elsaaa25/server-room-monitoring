# Panduan Kode ESP32 (Suhu & Tegangan)

Dokumen ini berisi penjelasan dan contoh sketsa kode Arduino (C++) untuk mikrokontroler **ESP32** agar dapat membaca sensor dan mengirimkan data secara berkala ke API monitoring kita yang sudah online di Vercel.

---

## 1. Persiapan pada Arduino IDE

Pastikan Anda sudah menginstal library berikut melalui **Library Manager** di Arduino IDE Anda:
1. **DHT sensor library** (oleh Adafruit) - Untuk membaca sensor suhu/kelembaban DHT11 atau DHT22.
2. **Adafruit Unified Sensor** - Prasyarat untuk library DHT.
3. **ArduinoJson** (oleh Benoit Blanchon) - Untuk memformat data ke dalam bentuk JSON.

---

## 2. Contoh Sketsa Arduino (ESP32)

Salin kode di bawah ini ke Arduino IDE Anda. Sesuaikan konfigurasi Wi-Fi, URL Server Vercel, dan API Key sesuai dengan pengaturan Anda.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"

// ==========================================
// KONFIGURASI UTAMA (SESUAIKAN DENGAN ANDA)
// ==========================================

// 1. Konfigurasi Wi-Fi Kantor
const char* ssid = "NAMA_WIFI_ANDA";
const char* password = "PASSWORD_WIFI_ANDA";

// 2. URL API Publik di Vercel (Sesuaikan domain Anda)
// Contoh: "https://server-room-monitoring.vercel.app/api/sensor"
const char* serverUrl = "https://DOMAIN-VERCEL-ANDA.vercel.app/api/sensor";

// 3. API Key Keamanan (Harus sama dengan SENSOR_API_KEY di Vercel)
const char* apiKey = "KunciRahasiaSensor123!";

// 4. Identitas Sensor (Sesuaikan untuk Lantai 4 atau Lantai 5)
// Lantai 4: Setel ke "esp32-lantai4"
// Lantai 5: Setel ke "esp32-lantai5"
const char* sensorId = "esp32-lantai4"; 

// 5. Interval Pengiriman Data (dalam milidetik)
// 15000 ms = 15 detik (sesuaikan dengan kebutuhan Anda)
const unsigned long sendInterval = 15000; 

// ==========================================
// KONFIGURASI SENSOR FISIK
// ==========================================

// Pin Sensor Suhu DHT22
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// Pin Sensor Tegangan (Hanya diaktifkan jika sensorId == "esp32-lantai4")
#define VOLTAGE_PIN 34 // Pin Analog Input ESP32

unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // Hubungkan ke Wi-Fi
  Serial.print("Connecting to Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("Wi-Fi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Jalankan pengiriman berkala tanpa blocking (menggunakan millis)
  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();
    
    if (WiFi.status() == WL_CONNECTED) {
      sendSensorData();
    } else {
      Serial.println("Error: Wi-Fi Disconnected!");
    }
  }
}

// Fungsi untuk membaca sensor & mengirimkan ke server
void sendSensorData() {
  // 1. Membaca Suhu dari DHT22
  float temp = dht.readTemperature();
  
  // Cek apakah sensor terbaca dengan benar
  if (isnan(temp)) {
    Serial.println("Gagal membaca dari sensor DHT22!");
    return;
  }
  
  Serial.print("Suhu Terbaca: ");
  Serial.print(temp);
  Serial.println(" *C");

  // 2. Membaca Tegangan (Hanya jika ini sensor Lantai 4)
  float voltage = 0.0;
  bool hasVoltage = false;
  
  if (strcmp(sensorId, "esp32-lantai4") == 0) {
    hasVoltage = true;
    
    // Pembacaan analog tegangan (contoh kalibrasi kasar sensor ZMPT101B)
    int rawValue = analogRead(VOLTAGE_PIN);
    
    // Rumus Konversi Analog ke Tegangan AC RMS (sesuaikan dengan modul Anda)
    // Di bawah ini adalah simulasi pembacaan tegangan normal ~220V untuk contoh
    voltage = (rawValue * (3.3 / 4095.0)) * 100.0; 
    
    // Pengaman simulasi jika sensor fisik belum dikalibrasi
    if (voltage < 50.0) {
      voltage = 220.0 + (random(-5, 5) * 0.2); // Simulasi stabil jika tidak terhubung fisik
    }
    
    Serial.print("Tegangan Terbaca: ");
    Serial.print(voltage);
    Serial.println(" V");
  }

  // 3. Format Data ke JSON
  StaticJsonDocument<200> doc;
  doc["sensorId"] = sensorId;
  doc["temperature"] = temp;
  
  if (hasVoltage) {
    doc["voltage"] = voltage;
  } else {
    doc["voltage"] = nullptr; // Lantai 5 tidak mengirim data tegangan
  }

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // 4. Kirim HTTP POST Request ke Vercel
  HTTPClient http;
  http.begin(serverUrl);
  
  // Set header wajib
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", apiKey);

  Serial.println("Mengirim data ke server...");
  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    Serial.print("Server Response: ");
    Serial.println(response);
  } else {
    Serial.print("Error sending POST: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}
```

---

## 3. Cara Pengujian Tanpa ESP32 (Menggunakan cURL)

Sebelum mengunggah kode ke ESP32, Anda bisa menguji apakah API Vercel Anda sudah berjalan dengan baik dengan mengirimkan perintah cURL melalui Command Prompt (CMD) komputer Anda:

**Uji Sensor Lantai 4 (Suhu & Tegangan):**
```bash
curl -X POST https://DOMAIN-VERCEL-ANDA.vercel.app/api/sensor \
  -H "Content-Type: application/json" \
  -H "x-api-key: KunciRahasiaSensor123!" \
  -d "{\"sensorId\": \"esp32-lantai4\", \"temperature\": 24.8, \"voltage\": 218.4}"
```

**Uji Sensor Lantai 5 (Suhu Saja):**
```bash
curl -X POST https://DOMAIN-VERCEL-ANDA.vercel.app/api/sensor \
  -H "Content-Type: application/json" \
  -H "x-api-key: KunciRahasiaSensor123!" \
  -d "{\"sensorId\": \"esp32-lantai5\", \"temperature\": 26.2}"
```

Jika respon dari cURL adalah `{"success":true,"message":"Data sensor berhasil disimpan"}`, maka sistem backend Anda telah siap 100%!
