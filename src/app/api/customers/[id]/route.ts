import { NextResponse } from "next/server";
import { getCustomerById, saveCustomer } from "@/lib/server-db";
import { CustomerAccount } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const current = await getCustomerById(id);
  if (!current) {
    return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
  }

  const body = (await request.json()) as CustomerAccount;
  const next: CustomerAccount = {
    ...current,
    ...body,
    id,
  };

  await saveCustomer(next);
  return NextResponse.json({ data: next });
}
