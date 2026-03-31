import { NextResponse } from "next/server";
import { getOrders } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const orders = await getOrders();
  return NextResponse.json({ data: orders.filter((order) => order.fulfillmentMethod === "entrega") });
}
