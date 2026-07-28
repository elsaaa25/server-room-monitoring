import { readFileSync } from "node:fs"
import {
  createHash,
  randomBytes,
  randomInt,
} from "node:crypto"
import { parseEnv } from "node:util"
import { createInterface } from "node:readline/promises"
import {
  stdin as input,
  stdout as output,
} from "node:process"

import { hash } from "bcryptjs"
import pg from "pg"
import { Resend } from "resend"

// ======================================================
// MEMBACA ENVIRONMENT VARIABLE
// ======================================================

let env

try {
  const envPath = new URL("../.env.local", import.meta.url)
  const envContent = readFileSync(envPath, "utf8")

  env = parseEnv(envContent)
} catch (error) {
  console.error(
    "Gagal membaca .env.local:",
    error instanceof Error ? error.message : error,
  )

  process.exit(1)
}

const requiredEnv = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "APP_URL",
]

for (const key of requiredEnv) {
  if (!env[key]?.trim()) {
    console.error(`${key} belum diisi di .env.local`)
    process.exit(1)
  }
}

// ======================================================
// MEMBACA EMAIL DARI TERMINAL
// ======================================================

const [, , emailArgument] = process.argv
const email = emailArgument?.trim().toLowerCase()

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

if (!email || !emailPattern.test(email)) {
  console.error(
    "Gunakan perintah:\n" +
      "npm run user:create -- email@example.com",
  )

  process.exit(1)
}

// ======================================================
// MEMBACA NAMA ADMIN
// ======================================================

const readline = createInterface({
  input,
  output,
})

const name = (
  await readline.question("Nama lengkap admin: ")
).trim()

readline.close()

if (!name) {
  console.error("Nama admin tidak boleh kosong.")
  process.exit(1)
}

// ======================================================
// FUNGSI KEAMANAN
// ======================================================

function generateTemporaryPassword(length = 16) {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lowercase = "abcdefghijkmnopqrstuvwxyz"
  const numbers = "23456789"
  const symbols = "!@#$%^&*_-"

  const allCharacters =
    uppercase + lowercase + numbers + symbols

  const characters = [
    uppercase[randomInt(uppercase.length)],
    lowercase[randomInt(lowercase.length)],
    numbers[randomInt(numbers.length)],
    symbols[randomInt(symbols.length)],
  ]

  while (characters.length < length) {
    characters.push(
      allCharacters[randomInt(allCharacters.length)],
    )
  }

  // Mengacak posisi karakter menggunakan randomInt.
  for (let index = characters.length - 1; index > 0; index--) {
    const randomIndex = randomInt(index + 1)

    ;[characters[index], characters[randomIndex]] = [
      characters[randomIndex],
      characters[index],
    ]
  }

  return characters.join("")
}

function hashToken(token) {
  return createHash("sha256")
    .update(token)
    .digest("hex")
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

// ======================================================
// MEMBUAT PASSWORD DAN TOKEN
// ======================================================

const temporaryPassword = generateTemporaryPassword()

const verificationToken = randomBytes(32).toString("hex")
const verificationTokenHash = hashToken(verificationToken)

const verificationExpiresAt = new Date(
  Date.now() + 60 * 60 * 1000,
)

const passwordHash = await hash(temporaryPassword, 12)

const appUrl = env.APP_URL.replace(/\/+$/, "")

const verificationUrl =
  `${appUrl}/verifikasi-email` +
  `?token=${encodeURIComponent(verificationToken)}`

// ======================================================
// DATABASE DAN EMAIL
// ======================================================

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

const resend = new Resend(env.RESEND_API_KEY)

let transactionStarted = false

try {
  await pool.query("SELECT 1")

  const existingUser = await pool.query(
    `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  )

  if (existingUser.rowCount > 0) {
    throw new Error(
      "EMAIL_ALREADY_EXISTS",
    )
  }

  await pool.query("BEGIN")
  transactionStarted = true

  await pool.query(
    `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        is_active,
        email_verified_at,
        must_change_password,
        email_verification_token_hash,
        email_verification_expires_at,
        pending_password_hash,
        password_confirmation_token_hash,
        password_confirmation_expires_at,
        password_changed_at,
        session_version
      )
      VALUES (
        $1,
        $2,
        $3,
        'ADMIN',
        FALSE,
        NULL,
        TRUE,
        $4,
        $5,
        NULL,
        NULL,
        NULL,
        NULL,
        0
      )
    `,
    [
      name,
      email,
      passwordHash,
      verificationTokenHash,
      verificationExpiresAt,
    ],
  )

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [email],
    subject: "Verifikasi Akun Admin Monitoring Room",
    html: `
      <div
        style="
          max-width: 600px;
          margin: 0 auto;
          padding: 24px;
          font-family: Arial, sans-serif;
          color: #0f172a;
          line-height: 1.6;
        "
      >
        <h2 style="margin-bottom: 8px;">
          Verifikasi Akun Admin
        </h2>

        <p>Halo ${escapeHtml(name)},</p>

        <p>
          Akun administrator Monitoring Room telah dibuat
          menggunakan alamat email ini.
        </p>

        <p>
          Klik tombol berikut untuk memverifikasi alamat
          email dan mengaktifkan akun:
        </p>

        <p style="margin: 28px 0;">
          <a
            href="${verificationUrl}"
            style="
              display: inline-block;
              padding: 12px 20px;
              border-radius: 8px;
              background: #005a9c;
              color: white;
              text-decoration: none;
              font-weight: 600;
            "
          >
            Verifikasi Email
          </a>
        </p>

        <p>
          Tautan ini berlaku selama
          <strong>60 menit</strong> dan hanya dapat digunakan
          satu kali.
        </p>

        <p>
          Password sementara tidak dikirim melalui email.
          Mintalah password sementara kepada pengelola sistem.
        </p>

        <p
          style="
            margin-top: 28px;
            color: #64748b;
            font-size: 13px;
          "
        >
          Abaikan pesan ini apabila Anda tidak merasa dibuatkan
          akun Monitoring Room.
        </p>
      </div>
    `,
  })

  if (error) {
    throw new Error(`RESEND_ERROR:${error.message}`)
  }

  await pool.query("COMMIT")
  transactionStarted = false

  console.log("")
  console.log("========================================")
  console.log("AKUN ADMIN BERHASIL DIBUAT")
  console.log("========================================")
  console.log(`Nama               : ${name}`)
  console.log(`Email              : ${email}`)
  console.log("Role               : ADMIN")
  console.log("Status             : Menunggu verifikasi")
  console.log(`Password sementara : ${temporaryPassword}`)
  console.log(`Email ID           : ${data?.id ?? "-"}`)
  console.log("========================================")
  console.log("")
  console.log(
    "Simpan password sementara tersebut.",
  )
  console.log(
    "Password hanya ditampilkan satu kali di terminal.",
  )
} catch (error) {
  if (transactionStarted) {
    try {
      await pool.query("ROLLBACK")
    } catch (rollbackError) {
      console.error(
        "Rollback database gagal:",
        rollbackError,
      )
    }
  }

  const message =
    error instanceof Error ? error.message : String(error)

  if (message === "EMAIL_ALREADY_EXISTS") {
    console.error(
      `Akun dengan email ${email} sudah tersedia.`,
    )
  } else if (message.startsWith("RESEND_ERROR:")) {
    console.error(
      "Akun tidak jadi dibuat karena email verifikasi gagal dikirim.",
    )
    console.error(message.replace("RESEND_ERROR:", ""))
  } else if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "42703"
  ) {
    console.error(
      "Kolom keamanan akun belum tersedia di tabel users.",
    )
    console.error(
      "Jalankan migrasi database terlebih dahulu.",
    )
  } else {
    console.error("Gagal membuat akun admin:", message)
  }

  process.exitCode = 1
} finally {
  await pool.end()
}