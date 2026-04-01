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
  const normalizedUnit = (["und", "cx", "kg", "pact", "fardo"].includes(String(body.unit)) ? body.unit : "und") as Product["unit"];
  const next: Product = {
    ...body,
    id: body.id || crypto.randomUUID(),
    unit: normalizedUnit,
    createdAt: body.createdAt || new Date().toISOString(),
  };
  await saveProducts([next, ...products.filter((item) => item.id !== next.id)]);
  return NextResponse.json({ data: next });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<Product>;
  if (!body.id) {
    return NextResponse.json({ error: "ID do produto e obrigatorio." }, { status: 400 });
  }

  const products = await getProducts();
  const current = products.find((item) => item.id === body.id);
  if (!current) {
    return NextResponse.json({ error: "Produto nao encontrado." }, { status: 404 });
  }

  const normalizedUnit = (["und", "cx", "kg", "pact", "fardo"].includes(String(body.unit)) ? body.unit : current.unit) as Product["unit"];
  const next: Product = {
    ...current,
    ...body,
    unit: normalizedUnit,
    id: current.id,
    createdAt: current.createdAt,
  };

  await saveProducts([next, ...products.filter((item) => item.id !== next.id)]);
  return NextResponse.json({ data: next });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ success: false, error: "ID do produto e obrigatorio." }, { status: 400 });
  }

  const products = await getProducts();
  const exists = products.some((item) => item.id === body.id);
  if (!exists) {
    return NextResponse.json({ success: false, error: "Produto nao encontrado." }, { status: 404 });
  }

  await saveProducts(products.filter((item) => item.id !== body.id));
  return NextResponse.json({ success: true });
}
