import { NextResponse } from "next/server";
import { getCustomerById, getOrders, getSettings, saveCustomer, saveOrders } from "@/lib/server-db";
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
    cashbackGranted: Boolean(updated.cashbackGranted),
  };

  if (nextOrder.customerId && nextOrder.status === "entregue" && nextOrder.paymentConfirmed && !nextOrder.cashbackGranted) {
    const account = await getCustomerById(nextOrder.customerId);
    if (account) {
      const settings = await getSettings();
      const threshold = Number(settings.cashbackSpendThreshold || 0);
      const rewardValue = Number(settings.cashbackRewardValue || 0);

      if (threshold > 0 && rewardValue > 0) {
        const cycles = Math.floor(Number(nextOrder.total) / threshold);
        const cashback = Number((cycles * rewardValue).toFixed(2));

        if (cashback > 0) {
          await saveCustomer({
            ...account,
            cashbackBalance: Number((account.cashbackBalance + cashback).toFixed(2)),
          });
          nextOrder.cashbackGranted = true;
        }
      }
    }
  }

  await saveOrders(orders.map((order) => (order.id === id ? nextOrder : order)));

  return NextResponse.json({ data: nextOrder });
}
