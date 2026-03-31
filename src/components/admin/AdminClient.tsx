"use client";

import { getDashboardSummary, getDeliveryList, getOrdersForAdmin } from "@/lib/api";
import { addProduct, getAdminSettings, getProducts, saveAdminSettings } from "@/lib/storage";
import { DashboardSummary, Order, Product } from "@/types/domain";
import { useEffect, useMemo, useState } from "react";

type Tab = "dashboard" | "produtos" | "pedidos" | "entregas";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "produtos", label: "Produtos" },
  { id: "pedidos", label: "Pedidos" },
  { id: "entregas", label: "Entregas" },
];

const initialProduct = {
  name: "",
  price: "",
  image: "",
  category: "Mercearia",
};

export default function AdminClient() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    revenueToday: 0,
    ordersToday: 0,
    productsToday: 0,
    totalProducts: 0,
  });
  const [pixKey, setPixKey] = useState("");
  const [productForm, setProductForm] = useState(initialProduct);

  useEffect(() => {
    refreshAll();
    setPixKey(getAdminSettings().pixKey);
  }, []);

  async function refreshAll() {
    setProducts(getProducts());
    setOrders(await getOrdersForAdmin());
    setDeliveries(await getDeliveryList());
    setSummary(await getDashboardSummary());
  }

  function handleCreateProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!productForm.name || !productForm.price) return;

    const product: Product = {
      id: crypto.randomUUID(),
      name: productForm.name,
      price: Number(productForm.price),
      image: productForm.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=640&q=80",
      category: productForm.category,
      createdAt: new Date().toISOString(),
    };

    addProduct(product);
    setProductForm(initialProduct);
    refreshAll();
  }

  const totalItemsSold = useMemo(() => {
    return orders.reduce((sum, order) => sum + order.items.reduce((line, item) => line + item.quantity, 0), 0);
  }, [orders]);

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Painel Administrativo</h1>
            <p className="text-sm text-zinc-400">Solar Supermercado</p>
          </div>
          <a href="/loja" className="rounded-xl border border-[#1A1A1A] px-4 py-2 text-sm hover:border-[#00AAFF]">
            Abrir loja cliente
          </a>
        </header>

        <nav className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                activeTab === tab.id
                  ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]"
                  : "border-[#1A1A1A] text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "dashboard" && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
              <p className="text-xs uppercase text-zinc-500">Faturamento Hoje</p>
              <p className="mt-2 text-2xl font-black text-[#B2FF00]">R$ {summary.revenueToday.toFixed(2)}</p>
            </article>
            <article className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
              <p className="text-xs uppercase text-zinc-500">Pedidos Hoje</p>
              <p className="mt-2 text-2xl font-black">{summary.ordersToday}</p>
            </article>
            <article className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
              <p className="text-xs uppercase text-zinc-500">Produtos Cadastrados Hoje</p>
              <p className="mt-2 text-2xl font-black">{summary.productsToday}</p>
            </article>
            <article className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
              <p className="text-xs uppercase text-zinc-500">Itens Vendidos</p>
              <p className="mt-2 text-2xl font-black text-[#00AAFF]">{totalItemsSold}</p>
            </article>
          </section>
        )}

        {activeTab === "produtos" && (
          <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <form onSubmit={handleCreateProduct} className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
              <h2 className="text-lg font-bold">Cadastro de Produto</h2>
              <div className="mt-3 grid gap-2">
                <input
                  placeholder="Nome do produto"
                  value={productForm.name}
                  onChange={(event) => setProductForm((p) => ({ ...p, name: event.target.value }))}
                  className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
                <input
                  placeholder="Preco"
                  type="number"
                  step="0.01"
                  value={productForm.price}
                  onChange={(event) => setProductForm((p) => ({ ...p, price: event.target.value }))}
                  className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
                <input
                  placeholder="URL da imagem"
                  value={productForm.image}
                  onChange={(event) => setProductForm((p) => ({ ...p, image: event.target.value }))}
                  className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
                <input
                  placeholder="Categoria"
                  value={productForm.category}
                  onChange={(event) => setProductForm((p) => ({ ...p, category: event.target.value }))}
                  className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-xl bg-[#B2FF00] py-2 font-black text-black">
                  Salvar Produto
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
              <h2 className="text-lg font-bold">Configuracao Pix</h2>
              <p className="mt-1 text-xs text-zinc-400">Essa chave aparece no checkout do cliente.</p>
              <div className="mt-3 flex gap-2">
                <input
                  placeholder="Chave Pix"
                  value={pixKey}
                  onChange={(event) => setPixKey(event.target.value)}
                  className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => saveAdminSettings({ pixKey })}
                  className="rounded-xl bg-[#00AAFF] px-4 py-2 text-sm font-black text-black"
                >
                  Atualizar
                </button>
              </div>

              <h3 className="mt-5 text-sm font-semibold">Produtos em Cards</h3>
              <div className="mt-3 grid max-h-72 gap-2 overflow-auto">
                {products.map((product) => (
                  <article key={product.id} className="rounded-xl border border-[#1A1A1A] p-2 text-sm">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-zinc-400">{product.category}</p>
                    <p className="text-[#B2FF00]">R$ {product.price.toFixed(2)}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "pedidos" && (
          <section className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
            <h2 className="text-lg font-bold">Pedidos Recebidos via API/Checkout</h2>
            <div className="mt-3 space-y-3">
              {orders.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum pedido ainda.</p>
              ) : (
                orders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-[#1A1A1A] p-3 text-sm">
                    <p className="font-semibold">Pedido #{order.id.slice(0, 8)}</p>
                    <p className="text-zinc-400">Cliente: {order.customer.fullName}</p>
                    <p className="text-zinc-400">Telefone: {order.customer.phone}</p>
                    <p className="text-[#B2FF00]">Total R$ {order.total.toFixed(2)}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === "entregas" && (
          <section className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
            <h2 className="text-lg font-bold">Controle de Entrega (GET)</h2>
            <div className="mt-3 space-y-3">
              {deliveries.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem enderecos cadastrados.</p>
              ) : (
                deliveries.map((delivery) => (
                  <article key={delivery.id} className="rounded-xl border border-[#1A1A1A] p-3 text-sm">
                    <p className="font-semibold">#{delivery.id.slice(0, 8)}</p>
                    <p className="text-zinc-400">{delivery.customer.fullName}</p>
                    <p className="text-zinc-300">{delivery.customer.address}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
