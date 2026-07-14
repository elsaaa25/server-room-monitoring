import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Route /api/sensor aktif",
    methods: ["GET", "POST"],
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    return NextResponse.json(
      {
        success: true,
        message: "POST /api/sensor berhasil",
        received: body,
      },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "JSON tidak valid",
      },
      { status: 400 },
    )
  }
}