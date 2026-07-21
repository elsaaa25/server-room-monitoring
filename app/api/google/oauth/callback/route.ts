import { google } from "googleapis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)

  const oauthError = url.searchParams.get("error")

  if (oauthError) {
    return Response.json(
      {
        success: false,
        error: `Google OAuth gagal: ${oauthError}`,
      },
      {
        status: 400,
      },
    )
  }

  const code = url.searchParams.get("code")

  if (!code) {
    return Response.json(
      {
        success: false,
        error: "Kode OAuth Google tidak ditemukan",
      },
      {
        status: 400,
      },
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return Response.json(
      {
        success: false,
        error:
          "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, atau GOOGLE_REDIRECT_URI belum lengkap",
      },
      {
        status: 500,
      },
    )
  }

  try {
    const oauthClient = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    )

    const { tokens } =
      await oauthClient.getToken(code)

    if (!tokens.refresh_token) {
      return Response.json(
        {
          success: false,
          error:
            "Refresh token tidak diberikan. Buka kembali route OAuth start dan berikan izin ulang.",
        },
        {
          status: 400,
        },
      )
    }

    return Response.json({
      success: true,
      message:
        "Google Drive berhasil dihubungkan. Salin refreshToken ke .env.local.",
      refreshToken: tokens.refresh_token,
    })
  } catch (error) {
    console.error(
      "Gagal memproses callback Google:",
      error,
    )

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mendapatkan token Google",
      },
      {
        status: 500,
      },
    )
  }
}