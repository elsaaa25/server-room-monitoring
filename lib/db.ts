import "server-only"
import { Pool } from "pg"

let dbHost = process.env.DB_HOST
let dbPort = process.env.DB_PORT
let dbName = process.env.DB_NAME
let dbUser = process.env.DB_USER
let dbPassword = process.env.DB_PASSWORD

if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL)
    dbHost = url.hostname
    dbPort = url.port || "5432"
    dbName = url.pathname.split("?")[0].slice(1)
    dbUser = url.username
    dbPassword = decodeURIComponent(url.password)
  } catch (error) {
    console.error("Gagal mengurai DATABASE_URL:", error)
  }
}

if (
  typeof dbHost !== "string" ||
  typeof dbPort !== "string" ||
  typeof dbName !== "string" ||
  typeof dbUser !== "string" ||
  typeof dbPassword !== "string" ||
  dbHost.trim() === "" ||
  dbPort.trim() === "" ||
  dbName.trim() === "" ||
  dbUser.trim() === "" ||
  dbPassword.trim() === ""
) {
  console.error("Status environment database:", {
    dbHost: typeof dbHost === "string" && dbHost.length > 0,
    dbPort: typeof dbPort === "string" && dbPort.length > 0,
    dbName: typeof dbName === "string" && dbName.length > 0,
    dbUser: typeof dbUser === "string" && dbUser.length > 0,
    dbPassword:
      typeof dbPassword === "string" &&
      dbPassword.length > 0,
  })

  throw new Error(
    "Konfigurasi database belum lengkap di .env.local"
  )
}

console.log("db.ts berhasil dimuat:", {
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: dbUser,
  passwordType: typeof dbPassword,
  passwordLoaded: dbPassword.length > 0,
})

const globalForDatabase = globalThis as unknown as {
  db?: Pool
}

export const db =
  globalForDatabase.db ??
  new Pool({
    host: dbHost,
    port: Number(dbPort),
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: {
      rejectUnauthorized: false,
    },
  })

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.db = db
}