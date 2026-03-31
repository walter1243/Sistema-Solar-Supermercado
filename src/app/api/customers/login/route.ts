import { NextResponse } from "next/server";
import { getCustomerByPhone } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { phone?: string; password?: string };
  const phone = body.phone?.trim();
  const password = body.password?.trim();

  if (!phone || !password) {
    return NextResponse.json({ error: "Telefone e senha obrigatorios." }, { status: 400 });
  }

  const account = await getCustomerByPhone(phone);
  if (!account || account.password !== password) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  const response = NextResponse.json({ data: account });
  response.cookies.set("solar_customer_id", account.id, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return response;
}
