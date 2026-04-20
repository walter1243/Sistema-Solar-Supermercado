import { NextRequest, NextResponse } from "next/server";
import { updateReceivableAccount } from "@/lib/server-db";
import { ReceivableAccount } from "@/types/domain";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  return request.cookies.get("solar_admin_session")?.value === "1" || Boolean(request.cookies.get("solar_admin_username")?.value);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const { id } = params;
    const body = (await request.json()) as Omit<ReceivableAccount, "id" | "createdAt">;
    const account = await updateReceivableAccount(id, body);
    return NextResponse.json({ data: account }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao atualizar conta recebida." }, { status: 400 });
  }
}
