import { addCustomerAlert, getCustomerAlerts, markCustomerAlertAsRead } from "@/lib/server-db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const customerId = request.nextUrl.searchParams.get("customerId")?.trim();
    if (!customerId) {
      return NextResponse.json({ error: "customerId obrigatorio." }, { status: 400 });
    }

    const data = await getCustomerAlerts(customerId);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Falha ao buscar alertas no servidor." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { customerId?: string; title?: string; message?: string };
    const customerId = body.customerId?.trim();
    const title = body.title?.trim();
    const message = body.message?.trim();

    if (!customerId || !title || !message) {
      return NextResponse.json({ error: "customerId, title e message sao obrigatorios." }, { status: 400 });
    }

    const alert = await addCustomerAlert(customerId, title, message);

    return NextResponse.json({ success: true, data: alert });
  } catch {
    return NextResponse.json({ error: "Falha ao salvar alerta no servidor." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { customerId?: string; alertId?: string };
    const customerId = body.customerId?.trim();
    const alertId = body.alertId?.trim();

    if (!customerId || !alertId) {
      return NextResponse.json({ error: "customerId e alertId sao obrigatorios." }, { status: 400 });
    }

    await markCustomerAlertAsRead(customerId, alertId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Falha ao atualizar alerta no servidor." }, { status: 500 });
  }
}
