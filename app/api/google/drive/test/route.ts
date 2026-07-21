import { Readable } from "node:stream"
import { google } from "googleapis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI

  const refreshToken =
    process.env.GOOGLE_REFRESH_TOKEN

  const folderId =
    process.env.GOOGLE_DRIVE_FOLDER_ID

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !refreshToken ||
    !folderId
  ) {
    return Response.json(
      {
        success: false,
        error:
          "Environment variable Google belum lengkap",
        missing: {
          clientId: !clientId,
          clientSecret: !clientSecret,
          redirectUri: !redirectUri,
          refreshToken: !refreshToken,
          folderId: !folderId,
        },
      },
      {
        status: 500,
      },
    )
  }

  try {
    const auth = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    )

    auth.setCredentials({
      refresh_token: refreshToken,
    })

    const drive = google.drive({
      version: "v3",
      auth,
    })

    const content =
      "Tes koneksi Google Drive berhasil."

    const result =
      await drive.files.create({
        requestBody: {
          name: `tes-koneksi-${Date.now()}.txt`,
          mimeType: "text/plain",

          // Menentukan folder tujuan.
          parents: [folderId],
        },

        media: {
          mimeType: "text/plain",
          body: Readable.from([content]),
        },

        fields:
          "id,name,parents,webViewLink",
      })

    return Response.json({
      success: true,
      message:
        "File tes berhasil diunggah ke folder Google Drive",
      file: result.data,
    })
  } catch (error) {
    console.error(
      "Tes Google Drive gagal:",
      error,
    )

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengunggah file tes",
      },
      {
        status: 500,
      },
    )
  }
}