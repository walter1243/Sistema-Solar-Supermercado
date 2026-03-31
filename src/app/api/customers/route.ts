import { NextRequest, NextResponse } from "next/server";
import { getCustomers } from "@/lib/server-db";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  return request.cookies.get("solar_admin_session")?.value === "1" || Boolean(request.cookies.get("solar_admin_username")?.value);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const customers = await getCustomers();
  return NextResponse.json({ data: customers });
}
