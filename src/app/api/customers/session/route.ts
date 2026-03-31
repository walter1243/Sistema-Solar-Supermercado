import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customerId = request.cookies.get("solar_customer_id")?.value;
  if (!customerId) return NextResponse.json({ data: null });
  const account = await getCustomerById(customerId);
  return NextResponse.json({ data: account || null });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("solar_customer_id", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  return response;
}
