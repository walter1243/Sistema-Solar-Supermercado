import { NextResponse } from "next/server";
import { getOrders, saveOrders } from "@/lib/server-db";
import { Order } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { pixProofFileName?: string; pixProofDataUrl?: string };

  if (!body.pixProofDataUrl) {
    return NextResponse.json({ error: "Comprovante Pix invalido." }, { status: 400 });
  }

  const orders = await getOrders();
  const selected = orders.find((order) => order.id === id);

  if (!selected) {
    return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
  }

  if (selected.paymentMethod !== "pix") {
    return NextResponse.json({ error: "Este pedido nao usa pagamento Pix." }, { status: 400 });
  }

  const updated: Order = {
    ...selected,
    pixProofFileName: body.pixProofFileName || "comprovante-pix",
    pixProofDataUrl: body.pixProofDataUrl,
    pixProofUploadedAt: new Date().toISOString(),
  };

  await saveOrders(orders.map((order) => (order.id === id ? updated : order)));
  return NextResponse.json({ data: updated });
}
