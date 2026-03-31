import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const active = request.cookies.get("solar_admin_session")?.value === "1" || Boolean(request.cookies.get("solar_admin_username")?.value);
  if (!active) return NextResponse.json({ data: null });
  const username = request.cookies.get("solar_admin_username")?.value || "admin";
  const profile = await getAdminProfile(username);
  return NextResponse.json({ data: profile });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("solar_admin_session", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  response.cookies.set("solar_admin_username", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  return response;
}
