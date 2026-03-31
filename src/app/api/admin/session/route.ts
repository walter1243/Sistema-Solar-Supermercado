import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const active = request.cookies.get("solar_admin_session")?.value === "1";
  if (!active) return NextResponse.json({ data: null });
  const profile = await getAdminProfile();
  return NextResponse.json({ data: profile });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("solar_admin_session", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  return response;
}
