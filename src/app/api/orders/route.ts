import { NextResponse } from "next/server";
import { getOrders, saveOrders } from "@/lib/server-db";
import { Order } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const orders = await getOrders();
  return NextResponse.json({ data: orders });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Order;
  const orders = await getOrders();
  const next: Order = {
    ...body,
    id: body.id || crypto.randomUUID(),
    createdAt: body.createdAt || new Date().toISOString(),
    cashbackGranted: Boolean(body.cashbackGranted),
    pixProofFileName: body.pixProofFileName || undefined,
    pixProofDataUrl: body.pixProofDataUrl || undefined,
    pixProofUploadedAt: body.pixProofUploadedAt || undefined,
  };
  await saveOrders([next, ...orders.filter((item) => item.id !== next.id)]);
  return NextResponse.json({ data: next });
}
