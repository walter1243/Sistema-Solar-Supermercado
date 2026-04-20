import { NextRequest, NextResponse } from "next/server";
import { createReceivableAccount, listReceivableAccounts } from "@/lib/server-db";
import { ReceivableAccount } from "@/types/domain";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  return request.cookies.get("solar_admin_session")?.value === "1" || Boolean(request.cookies.get("solar_admin_username")?.value);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const accounts = await listReceivableAccounts();
  return NextResponse.json({ data: accounts });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Omit<ReceivableAccount, "id" | "createdAt">;
    const account = await createReceivableAccount(body);
    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao salvar conta recebida." }, { status: 400 });
  }
}
