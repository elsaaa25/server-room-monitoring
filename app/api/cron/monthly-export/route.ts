import { google } from "googleapis"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function createOAuthClient() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    throw new Error(
      "Environment variable Google OAuth belum lengkap",
    )
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  )
}

export async function GET(
  request: Request,
) {
  const url = new URL(request.url)

  const oauthError =
    url.searchParams.get("error")

  if (oauthError) {
    return NextResponse.json(
      {
        success: false,
        error: `Google OAuth gagal: ${oauthError}`,
      },
      {
        status: 400,
      },
    )
  }

  const code =
    url.searchParams.get("code")

  if (!code) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Kode otorisasi Google tidak ditemukan",
      },
      {
        status: 400,
      },
    )
  }

  try {
    const oauthClient =
      createOAuthClient()

    const { tokens } =
      await oauthClient.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Google tidak memberikan refresh token. Pastikan route OAuth start menggunakan access_type offline dan prompt consent.",
        },
        {
          status: 400,
        },
      )
    }

    return NextResponse.json({
      success: true,
      message:
        "Google Drive berhasil dihubungkan. Salin refreshToken ke GOOGLE_REFRESH_TOKEN di .env.local.",
      refreshToken:
        tokens.refresh_token,
    })
  } catch (error) {
    console.error(
      "Google OAuth callback gagal:",
      error,
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menukar kode OAuth Google",
      },
      {
        status: 500,
      },
    )
  }
}