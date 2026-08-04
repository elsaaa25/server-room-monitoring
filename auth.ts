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
          `
    SELECT
      id::text,
      name,
      email,
      password_hash,
      role,
      email_verified_at,
      must_change_password,
      session_version
    FROM users
    WHERE LOWER(email) = LOWER($1)
      AND is_active = TRUE
      AND email_verified_at IS NOT NULL
    LIMIT 1
  `,
          [parsed.data.email],
        )
        const user = result.rows[0]

        if (
          !user ||
          !(await compare(
            parsed.data.password,
            user.password_hash,
          ))
        ) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: "ADMIN" as const,
          mustChangePassword: Boolean(
            user.must_change_password,
          ),
          sessionVersion: Number(user.session_version),
        }
      }
    }),
  ],
  callbacks: {
  async jwt({
    token,
    user,
    trigger,
  }) {
    if (user) {
      token.name = user.name
      token.email = user.email
      token.role = user.role
    }

    /*
     * Ketika profile-page memanggil updateSession(),
     * ambil ulang nama terbaru langsung dari database.
     *
     * Data tidak dipercaya langsung dari browser.
     */
    if (
      trigger === "update" &&
      token.sub
    ) {
      const result = await db.query(
        `
          SELECT
            name,
            email,
            role
          FROM users
          WHERE id = $1
            AND is_active = TRUE
          LIMIT 1
        `,
        [token.sub],
      )

      const currentUser =
        result.rows[0]

      if (currentUser) {
        token.name =
          currentUser.name

        token.email =
          currentUser.email

        token.role =
          currentUser.role
      }
    }

    return token
  },

  session({
    session,
    token,
  }) {
    if (session.user) {
      session.user.id =
        token.sub ?? ""

      session.user.name =
        typeof token.name ===
        "string"
          ? token.name
          : null

      session.user.email =
        typeof token.email ===
        "string"
          ? token.email
          : null

      session.user.role =
        token.role as
          | "OPERATOR"
          | "ADMIN"
    }

    return session
  },

  authorized({
    auth: session,
    request,
  }) {
    const pathname =
      request.nextUrl.pathname

    const publicRoutes = [
      "/login",
      "/verifikasi-email",
      "/api/account/verify-email",
      "/api/auth",
    ]

    const isPublicRoute =
      publicRoutes.some(
        route =>
          pathname === route ||
          pathname.startsWith(
            `${route}/`,
          ),
      )

    if (isPublicRoute) {
      return true
    }

    if (!session?.user) {
      return false
    }

    return true
  },
},
})
