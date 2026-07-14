import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { z } from "zod"
import { db } from "@/lib/db"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials)
        if (!parsed.success) return null
        const result = await db.query(
          `SELECT id::text, name, email, password_hash, role
           FROM users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE LIMIT 1`,
          [parsed.data.email],
        )
        const user = result.rows[0]
        if (!user || !(await compare(parsed.data.password, user.password_hash))) return null
        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = user.role
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ""
        session.user.role = token.role as "OPERATOR" | "ADMIN"
      }
      return session
    },
    authorized({ auth: session, request }) {
  const pathname = request.nextUrl.pathname

  // Halaman dan endpoint autentikasi
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth")
  ) {
    return true
  }

  // Endpoint untuk ESP32.
  // Diamankan dengan SENSOR_API_KEY pada route.ts.
  if (pathname === "/api/sensor") {
    return true
  }

  // Halaman dan API lainnya membutuhkan login
  if (!session?.user) {
    return false
  }

  if (
    pathname.startsWith("/pengaturan") &&
    session.user.role !== "ADMIN"
  ) {
    return false
  }

  return true
},
  },
})
