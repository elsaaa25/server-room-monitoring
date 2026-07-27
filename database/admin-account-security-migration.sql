ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE,

ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS pending_password_hash TEXT,
ADD COLUMN IF NOT EXISTS password_confirmation_token_hash TEXT,
ADD COLUMN IF NOT EXISTS password_confirmation_expires_at TIMESTAMPTZ,

ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;