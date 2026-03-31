import { NextResponse } from "next/server";
import { getAdminProfileByUsername } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const username = body.username?.trim();
  const password = body.password?.trim();

  const profile = username ? await getAdminProfileByUsername(username) : null;
  if (!username || !password || !profile || username !== profile.username || password !== profile.password) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  const response = NextResponse.json({ data: profile });
  response.cookies.set("solar_admin_session", "1", { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  response.cookies.set("solar_admin_username", profile.username, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return response;
}
