import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";

type CustomerAlert = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
};

export const dynamic = "force-dynamic";

function alertsKey(customerId: string) {
  return `solar:alerts:${customerId}`;
}

export async function GET(request: NextRequest) {
  try {
    const customerId = request.nextUrl.searchParams.get("customerId")?.trim();
    if (!customerId) {
      return NextResponse.json({ error: "customerId obrigatorio." }, { status: 400 });
    }

    const data = (await kv.lrange(alertsKey(customerId), 0, -1)) as CustomerAlert[];
    return NextResponse.json({ data: Array.isArray(data) ? data : [] });
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

    const alert: CustomerAlert = {
      id: crypto.randomUUID(),
      title,
      message,
      createdAt: new Date().toISOString(),
    };

    await kv.lpush(alertsKey(customerId), alert);
    await kv.ltrim(alertsKey(customerId), 0, 99);

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

    const key = alertsKey(customerId);
    const alerts = ((await kv.lrange(key, 0, -1)) as CustomerAlert[]) || [];
    const nextAlerts = alerts.map((alert) => (alert.id === alertId ? { ...alert, readAt: new Date().toISOString() } : alert));

    await kv.del(key);
    if (nextAlerts.length) {
      await kv.rpush(key, ...nextAlerts);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Falha ao atualizar alerta no servidor." }, { status: 500 });
  }
}
