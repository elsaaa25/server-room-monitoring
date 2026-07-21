import { Readable } from "node:stream"
import { google } from "googleapis"

const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function getGoogleDriveConfig() {
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
    throw new Error(
      "Environment variable Google Drive belum lengkap",
    )
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    refreshToken,
    folderId,
  }
}

function createGoogleDriveClient() {
  const config = getGoogleDriveConfig()

  const auth = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  )

  auth.setCredentials({
    refresh_token: config.refreshToken,
  })

  const drive = google.drive({
    version: "v3",
    auth,
  })

  return {
    drive,
    folderId: config.folderId,
  }
}

export async function uploadExcelToGoogleDrive({
  fileName,
  fileBuffer,
}: {
  fileName: string
  fileBuffer: Buffer
}) {
  const { drive, folderId } =
    createGoogleDriveClient()

  const result = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: EXCEL_MIME_TYPE,
      parents: [folderId],
    },
    media: {
      mimeType: EXCEL_MIME_TYPE,
      body: Readable.from([fileBuffer]),
    },
    fields:
      "id,name,parents,webViewLink",
  })

  if (!result.data.id) {
    throw new Error(
      "Google Drive tidak mengembalikan file ID",
    )
  }

  return {
    id: result.data.id,
    name: result.data.name ?? fileName,
    webViewLink:
      result.data.webViewLink ?? null,
    parents: result.data.parents ?? [],
  }
}