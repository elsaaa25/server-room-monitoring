import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"
import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { hash } from "bcryptjs"
import pg from "pg"

let env

try {
  const envPath = new URL("../.env.local", import.meta.url)
  const envContent = readFileSync(envPath, "utf8")
  env = parseEnv(envContent)
} catch (error) {
  console.error("Gagal membaca .env.local:", error.message)
  process.exit(1)
}

const requiredEnv = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
]

for (const key of requiredEnv) {
  if (!env[key]) {
    console.error(`${key} belum diisi di .env.local`)
    process.exit(1)
  }
}

const [, , emailArg, roleArg = "OPERATOR"] = process.argv

const email = emailArg?.trim().toLowerCase()
const role = roleArg.toUpperCase()

if (
  !email ||
  !email.includes("@") ||
  !["OPERATOR", "ADMIN"].includes(role)
) {
  console.error(
    "Gunakan: npm run user:create -- email@example.com ADMIN"
  )
  process.exit(1)
}

console.log("Konfigurasi database:", {
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  passwordLoaded: Boolean(env.DB_PASSWORD),
  passwordLength: env.DB_PASSWORD.length,
})

if (
  env.DB_HOST.endsWith(".pooler.supabase.com") &&
  !env.DB_USER.startsWith("postgres.")
) {
  console.error(
    "Username Supabase Pooler harus menggunakan format postgres.PROJECT_REF"
  )
  process.exit(1)
}

const pool = new pg.Pool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
})

const rl = createInterface({
  input,
  output,
})

const name = (await rl.question("Nama pengguna: ")).trim()
const password = await hiddenQuestion(
  "Password akun aplikasi (min. 8 karakter): "
)

rl.close()

if (!name) {
  console.error("Nama pengguna tidak boleh kosong.")
  await pool.end()
  process.exit(1)
}

if (password.length < 8) {
  console.error("Password terlalu pendek.")
  await pool.end()
  process.exit(1)
}

try {
  await pool.query("SELECT 1")

  console.log("Koneksi ke database Supabase berhasil.")

  await pool.query(
    `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        is_active = TRUE,
        updated_at = NOW()
    `,
    [
      name,
      email,
      await hash(password, 12),
      role,
    ]
  )

  console.log(`Akun ${email} (${role}) berhasil dibuat.`)
} catch (error) {
  if (error.code === "28P01") {
    console.error(
      "Username atau password database Supabase tidak cocok."
    )
  } else if (error.code === "42P01") {
    console.error(
      'Tabel "users" belum tersedia di database Supabase.'
    )
  } else if (error.code === "ENOTFOUND") {
    console.error(
      "Alamat host database tidak ditemukan. Periksa DB_HOST."
    )
  } else {
    console.error("Gagal membuat akun:", error.message)
    console.error("Kode error:", error.code)
  }

  process.exitCode = 1
} finally {
  await pool.end()
}

function hiddenQuestion(prompt) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return rl.question(prompt)
  }

  return new Promise((resolve, reject) => {
    let value = ""

    output.write(prompt)
    input.setRawMode(true)
    input.resume()

    const cleanup = () => {
      input.setRawMode(false)
      input.pause()
      input.off("data", onData)
    }

    const onData = (buffer) => {
      const key = buffer.toString()

      if (key === "\u0003") {
        cleanup()
        reject(new Error("Dibatalkan"))
        return
      }

      if (key === "\r" || key === "\n") {
        cleanup()
        output.write("\n")
        resolve(value)
        return
      }

      if (key === "\u007f" || key === "\b") {
        if (value) {
          value = value.slice(0, -1)
          output.write("\b \b")
        }
        return
      }

      value += key
      output.write("*")
    }

    input.on("data", onData)
  })
}