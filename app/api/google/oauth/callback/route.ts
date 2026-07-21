export const runtime = "nodejs"

export async function GET() {
  return Response.json({
    success: true,
    message: "Route callback Google OAuth aktif",
  })
}