import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile, saveAdminProfile } from "@/lib/server-db";
import { AdminUser } from "@/types/domain";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  return request.cookies.get("solar_admin_session")?.value === "1" || Boolean(request.cookies.get("solar_admin_username")?.value);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const username = request.cookies.get("solar_admin_username")?.value || "admin";
  const profile = await getAdminProfile(username);
  return NextResponse.json({ data: profile });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const body = (await request.json()) as AdminUser;
  const currentUsername = request.cookies.get("solar_admin_username")?.value || "admin";
  const saved = await saveAdminProfile(currentUsername, body);
  const response = NextResponse.json({ data: saved });
  response.cookies.set("solar_admin_session", "1", { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  response.cookies.set("solar_admin_username", saved.username, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return response;
}
