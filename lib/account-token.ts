import "server-only"

import { createHash, randomBytes } from "node:crypto"

const EMAIL_VERIFICATION_DURATION = 60 * 60 * 1000
const PASSWORD_CONFIRMATION_DURATION = 30 * 60 * 1000

export function hashAccountToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function createAccountToken(duration: number) {
  const token = randomBytes(32).toString("hex")

  return {
    token,
    tokenHash: hashAccountToken(token),
    expiresAt: new Date(Date.now() + duration),
  }
}

export function createEmailVerificationToken() {
  return createAccountToken(EMAIL_VERIFICATION_DURATION)
}

export function createPasswordConfirmationToken() {
  return createAccountToken(PASSWORD_CONFIRMATION_DURATION)
}