import "server-only"

import { createHash, randomBytes } from "node:crypto"

const EMAIL_VERIFICATION_DURATION = 60 * 60 * 1000 // 60 menit

export function hashAccountToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createEmailVerificationToken() {
  const token = randomBytes(32).toString("hex")

  return {
    token,
    tokenHash: hashAccountToken(token),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_DURATION),
  }
}