import { NextResponse } from "next/server";
import { getProducts, saveProducts } from "@/lib/server-db";
import { Product } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getProducts();
  return NextResponse.json({ data: products });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Product;
  const products = await getProducts();
  const next: Product = {
    ...body,
    id: body.id || crypto.randomUUID(),
    createdAt: body.createdAt || new Date().toISOString(),
  };
  await saveProducts([next, ...products.filter((item) => item.id !== next.id)]);
  return NextResponse.json({ data: next });
}
