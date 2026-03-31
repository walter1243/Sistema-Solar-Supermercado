import { NextResponse } from "next/server";
import { getCustomerById, getOrders, saveCustomer, saveOrders } from "@/lib/server-db";
import { Order } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { status?: Order["status"]; paymentConfirmed?: boolean };

  const orders = await getOrders();
  const updated = orders.find((order) => order.id === id);
  if (!updated) {
    return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
  }

  const nextOrder: Order = {
    ...updated,
    status: body.status || updated.status,
    paymentConfirmed: body.paymentConfirmed ?? updated.paymentConfirmed,
  };

  await saveOrders(orders.map((order) => (order.id === id ? nextOrder : order)));

  if (nextOrder.customerId && nextOrder.status === "entregue" && nextOrder.paymentConfirmed) {
    const account = await getCustomerById(nextOrder.customerId);
    if (account) {
      const cashback = Number((nextOrder.total * 0.02).toFixed(2));
      await saveCustomer({
        ...account,
        cashbackBalance: Number((account.cashbackBalance + cashback).toFixed(2)),
      });
    }
  }

  return NextResponse.json({ data: nextOrder });
}
