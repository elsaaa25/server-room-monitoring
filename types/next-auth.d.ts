import "next-auth"

declare module "next-auth" {
  interface User {
    role: "ADMIN"
    mustChangePassword: boolean
    sessionVersion: number
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      role: "ADMIN"
      mustChangePassword: boolean
      sessionVersion: number
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN"
    mustChangePassword?: boolean
    sessionVersion?: number
  }
}