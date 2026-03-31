import { NextResponse } from "next/server";
import { customerByPhoneKey, saveCustomer } from "@/lib/server-db";
import { kv } from "@vercel/kv";
import { CustomerAccount } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as CustomerAccount;
  const phoneKey = customerByPhoneKey(body.phone);
  const exists = await kv.get<string>(phoneKey);
  if (exists) {
    return NextResponse.json({ error: "Telefone ja cadastrado." }, { status: 409 });
  }

  const account: CustomerAccount = {
    ...body,
    id: body.id || crypto.randomUUID(),
    cashbackBalance: Number(body.cashbackBalance || 0),
  };

  await saveCustomer(account);

  const response = NextResponse.json({ data: account });
  response.cookies.set("solar_customer_id", account.id, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return response;
}
