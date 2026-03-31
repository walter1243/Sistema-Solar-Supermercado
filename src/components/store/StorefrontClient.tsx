"use client";

import { postOrder } from "@/lib/api";
import { addOrder, getAdminSettings, getProducts } from "@/lib/storage";
import { CartItem, CustomerProfile, Order, Product } from "@/types/domain";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const profileDefault: CustomerProfile = {
  fullName: "",
  cpf: "",
  phone: "",
  address: "",
};

export default function StorefrontClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [profile, setProfile] = useState<CustomerProfile>(profileDefault);
  const [pixKey, setPixKey] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutDone, setCheckoutDone] = useState(false);

  useEffect(() => {
    setProducts(getProducts());
    setPixKey(getAdminSettings().pixKey);
  }, []);

  const quantityMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => map.set(item.productId, item.quantity));
    return map;
  }, [cart]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const total = useMemo(() => {
    return cart.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return sum;
      return sum + product.price * item.quantity;
    }, 0);
  }, [cart, products]);

  function addToCart(productId: string) {
    setCart((prev) => {
      const index = prev.findIndex((item) => item.productId === productId);
      if (index === -1) return [...prev, { productId, quantity: 1 }];
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].quantity + 1 };
      return next;
    });
  }

  async function submitOrder() {
    if (!cart.length) return;
    if (!profile.cpf || !profile.phone || !profile.address || !profile.fullName) {
      setProfileOpen(true);
      return;
    }

    const order: Order = {
      id: crypto.randomUUID(),
      items: cart.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        return {
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
        };
      }),
      customer: profile,
      total,
      status: "novo",
      paymentMethod: "pix",
      createdAt: new Date().toISOString(),
    };

    addOrder(order);
    await postOrder(order);

    setCart([]);
    setCheckoutDone(true);
    setCartOpen(false);
  }

  return (
    <div className="min-h-screen bg-black pb-28 text-white">
      <header className="sticky top-0 z-30 border-b border-[#1A1A1A] bg-black/85 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-solar.svg" alt="Solar Supermercado" className="h-10 w-10" />
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Solar</p>
              <p className="text-sm font-bold">Supermercado</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="rounded-full border border-[#1A1A1A] p-2"
              aria-label="Perfil"
            >
              <User size={18} />
            </button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative rounded-full bg-[#B2FF00] p-2 text-black"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#00AAFF] text-xs font-bold text-black">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        <h1 className="text-2xl font-black tracking-tight">Carrinho de Compras</h1>
        <p className="mt-1 text-sm text-zinc-400">Interface otimizada para abrir dentro do navegador do Instagram.</p>

        <div className="mt-4 grid gap-3">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-[#1A1A1A] bg-[#080808]">
              <img src={product.image} alt={product.name} className="h-28 w-full object-cover" loading="lazy" />
              <div className="p-3">
                <p className="text-xs text-zinc-500">{product.category}</p>
                <h2 className="text-sm font-semibold">{product.name}</h2>
                <div className="mt-2 flex items-center justify-between">
                  <strong className="text-[#B2FF00]">R$ {product.price.toFixed(2)}</strong>
                  <button
                    type="button"
                    onClick={() => addToCart(product.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00AAFF] text-lg font-black text-black"
                  >
                    +
                  </button>
                </div>
                {quantityMap.get(product.id) ? (
                  <p className="mt-2 text-xs text-zinc-400">Selecionados: {quantityMap.get(product.id)}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </main>

      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/75 p-4"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="mx-auto mt-20 max-w-md rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4"
            >
              <h3 className="text-lg font-bold">Cadastro rapido</h3>
              <div className="mt-3 grid gap-2">
                <input
                  placeholder="Nome completo"
                  value={profile.fullName}
                  onChange={(event) => setProfile((p) => ({ ...p, fullName: event.target.value }))}
                  className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
                <input
                  placeholder="CPF"
                  value={profile.cpf}
                  onChange={(event) => setProfile((p) => ({ ...p, cpf: event.target.value }))}
                  className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
                <input
                  placeholder="Telefone"
                  value={profile.phone}
                  onChange={(event) => setProfile((p) => ({ ...p, phone: event.target.value }))}
                  className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
                <textarea
                  placeholder="Endereco completo"
                  value={profile.address}
                  onChange={(event) => setProfile((p) => ({ ...p, address: event.target.value }))}
                  className="min-h-24 rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setProfileOpen(false)} className="w-full rounded-xl border border-[#1A1A1A] py-2 text-sm">
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70"
            onClick={() => setCartOpen(false)}
          >
            <motion.aside
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl border border-[#1A1A1A] bg-[#080808] p-4"
            >
              <h3 className="text-lg font-bold">Seu Carrinho</h3>
              <div className="mt-3 max-h-56 overflow-auto">
                {cart.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhum item selecionado.</p>
                ) : (
                  cart.map((item) => {
                    const product = products.find((p) => p.id === item.productId);
                    if (!product) return null;
                    return (
                      <div key={item.productId} className="mb-2 flex items-center justify-between text-sm">
                        <span>{product.name} x{item.quantity}</span>
                        <span>R$ {(product.price * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 rounded-xl border border-[#1A1A1A] bg-black p-3">
                <p className="text-xs text-zinc-400">Pagamento via Pix</p>
                <p className="text-sm font-semibold text-[#B2FF00]">
                  Chave: {pixKey || "Defina no painel administrativo"}
                </p>
                <p className="mt-2 text-lg font-black">Total: R$ {total.toFixed(2)}</p>
              </div>

              <button
                type="button"
                onClick={submitOrder}
                className="mt-4 w-full rounded-xl bg-[#B2FF00] py-3 font-black text-black"
              >
                Finalizar Pedido
              </button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {checkoutDone && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[92%] max-w-md -translate-x-1/2 rounded-xl border border-[#1A1A1A] bg-[#080808] p-3 text-center text-sm">
          Pedido enviado com sucesso para o painel administrativo.
        </div>
      )}

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-5 left-1/2 z-30 w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-[#00AAFF] py-3 text-sm font-black text-black shadow-[0_0_25px_rgba(0,170,255,0.35)]"
      >
        Abrir carrinho ({cartCount})
      </button>
    </div>
  );
}
