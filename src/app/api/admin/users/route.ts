import { NextRequest, NextResponse } from "next/server";
import { createAdminUser, deleteAdminUser, listAdminUsers } from "@/lib/server-db";
import { AdminUser } from "@/types/domain";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  return request.cookies.get("solar_admin_session")?.value === "1" || Boolean(request.cookies.get("solar_admin_username")?.value);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const users = await listAdminUsers();
  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as AdminUser;
    const created = await createAdminUser(body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao criar administrador." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { username?: string };
    await deleteAdminUser(body.username || "");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao remover administrador." }, { status: 400 });
  }
}