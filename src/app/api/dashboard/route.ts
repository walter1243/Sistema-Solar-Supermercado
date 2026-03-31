import { NextResponse } from "next/server";
import { getOrders, getProducts } from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toDateString();
  const orders = await getOrders();
  const products = await getProducts();

  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === today);
  const todayProducts = products.filter((product) => new Date(product.createdAt).toDateString() === today);

  return NextResponse.json({
    data: {
      revenueToday: todayOrders.reduce((sum, order) => sum + order.total, 0),
      ordersToday: todayOrders.length,
      productsToday: todayProducts.length,
      totalProducts: products.length,
    },
  });
}
