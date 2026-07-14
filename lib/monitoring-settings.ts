export type MonitoringSettings = {
  warningTemperature: number
  dangerTemperature: number
  refreshInterval: number
  offlineTimeout: number
  sensorName: string
  sensorId: string
  browserNotification: boolean
  soundAlert: boolean
}

export const defaultMonitoringSettings: MonitoringSettings = {
  warningTemperature: 27,
  dangerTemperature: 30,
  refreshInterval: 4,
  offlineTimeout: 30,
  sensorName: "Sensor Ruang Server",
  sensorId: "esp32-01",
  browserNotification: true,
  soundAlert: false,
}

export const monitoringSettingsKey = "server-room-settings"

export function readMonitoringSettings(): MonitoringSettings {
  try {
    const value = localStorage.getItem(monitoringSettingsKey)
    return value ? { ...defaultMonitoringSettings, ...JSON.parse(value) } : defaultMonitoringSettings
  } catch {
    return defaultMonitoringSettings
  }
}
