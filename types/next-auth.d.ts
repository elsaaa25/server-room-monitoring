import "next-auth"

declare module "next-auth" {
  interface User {
    role: "OPERATOR" | "ADMIN"
  }
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      role: "OPERATOR" | "ADMIN"
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "OPERATOR" | "ADMIN"
  }
}
