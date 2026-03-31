import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile, saveAdminProfile } from "@/lib/server-db";
import { AdminUser } from "@/types/domain";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  return request.cookies.get("solar_admin_session")?.value === "1";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const profile = await getAdminProfile();
  return NextResponse.json({ data: profile });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  const body = (await request.json()) as AdminUser;
  const saved = await saveAdminProfile(body);
  return NextResponse.json({ data: saved });
}
