"use client";

import {
  createProduct,
  getAdminSettingsRemote,
  getDashboardSummary,
  getDeliveryList,
  getOrdersForAdmin,
  getProductsCatalog,
  saveAdminSettingsRemote,
  updateOrderStatusRemote,
} from "@/lib/api";
import {
  authenticateAdmin,
  clearAdminSession,
  getAdminProfile,
  getAdminSession,
  getAdminSettings,
  saveAdminProfile,
  saveAdminSettings,
  updateOrderStatus,
} from "@/lib/storage";
import { AdminSettings, AdminUser, DashboardSummary, Order, Product } from "@/types/domain";
import {
  ChartNoAxesColumn,
  Eye,
  EyeOff,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PackageSearch,
  ReceiptText,
  Settings2,
  Truck,
  User,
  X,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";

type Tab = "dashboard" | "produtos" | "pedidos" | "entregas";

type ProductFormState = {
  name: string;
  price: string;
  image: string;
  category: string;
};

const tabs: Array<{ id: Tab; label: string; icon: ComponentType<{ size?: number }> }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "produtos", label: "Produtos", icon: PackageSearch },
  { id: "pedidos", label: "Pedidos", icon: ReceiptText },
  { id: "entregas", label: "Entregas", icon: Truck },
];

const initialProduct: ProductFormState = {
  name: "",
  price: "",
  image: "",
  category: "Mercearia",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildWhatsAppMessage(order: Order) {
  const items = order.items
    .map((item) => `- ${item.name} x${item.quantity} | ${formatCurrency(item.unitPrice * item.quantity)}`)
    .join("%0A");

  return [
    "*Novo pedido Solar Supermercado*",
    "",
    `Cliente: ${order.customer.fullName}`,
    `Telefone: ${order.customer.phone}`,
    `Endereco: ${order.customer.address}`,
    `Atendimento: ${order.fulfillmentMethod === "entrega" ? "Entrega" : "Retirada"}`,
    `Pagamento: ${order.paymentMethod}`,
    "",
    "*Itens*",
    items,
    "",
    `Total: ${formatCurrency(order.total)}`,
  ].join("%0A");
}

export default function AdminClient() {
  const productImageInputRef = useRef<HTMLInputElement | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authForm, setAuthForm] = useState({ username: "admin", password: "" });
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({ revenueToday: 0, ordersToday: 0, productsToday: 0, totalProducts: 0 });
  const [settings, setSettings] = useState<AdminSettings>(getAdminSettings());
  const [productForm, setProductForm] = useState<ProductFormState>(initialProduct);
  const [newCategory, setNewCategory] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", username: "", password: "", profileImage: "" });

  useEffect(() => {
    const session = getAdminSession();
    const profile = getAdminProfile();
    const adminSettings = getAdminSettings();
    setSettings(adminSettings);
    setProfileForm({
      name: profile.name,
      username: profile.username,
      password: profile.password || "123456",
      profileImage: profile.profileImage || "",
    });
    setProductForm((current) => ({ ...current, category: adminSettings.categories[0] || "Mercearia" }));

    if (session) {
      setAdminUser(session);
      void refreshAll();
    }
  }, []);

  async function refreshAll() {
    setProducts(await getProductsCatalog());
    setOrders(await getOrdersForAdmin());
    setDeliveries(await getDeliveryList());
    setSummary(await getDashboardSummary());
    setSettings(await getAdminSettingsRemote());
  }

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Dashboard";

  const totalItemsSold = useMemo(() => {
    return orders.reduce((sum, order) => sum + order.items.reduce((line, item) => line + item.quantity, 0), 0);
  }, [orders]);

  const averageTicket = useMemo(() => {
    if (!orders.length) return 0;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    return totalRevenue / orders.length;
  }, [orders]);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) || null, [orders, selectedOrderId]);

  function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const user = authenticateAdmin(authForm.username, authForm.password);
    if (!user) {
      setAuthError("Usuario ou senha invalidos.");
      return;
    }
    setAdminUser(user);
    setAuthError("");
    setAuthForm((current) => ({ ...current, password: "" }));
    void refreshAll();
  }

  function handleLogout() {
    clearAdminSession();
    setAdminUser(null);
    setMenuOpen(false);
  }

  async function handleCreateProduct(event: React.FormEvent) {
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

    await createProduct(product);
    setProductForm({ ...initialProduct, category: settings.categories[0] || "Mercearia" });
    void refreshAll();
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed || settings.categories.includes(trimmed)) return;
    const next = { ...settings, categories: [...settings.categories, trimmed] };
    setSettings(next);
    saveAdminSettings(next);
    setNewCategory("");
  }

  async function handleSaveSettings() {
    const nextSettings = await saveAdminSettingsRemote(settings);
    saveAdminSettings(nextSettings);
    setSettings(nextSettings);
    void refreshAll();
  }

  function handleSaveProfile() {
    const nextProfile: AdminUser = {
      name: profileForm.name,
      username: profileForm.username,
      password: profileForm.password,
      profileImage: profileForm.profileImage,
    };
    saveAdminProfile(nextProfile);
    setAdminUser(nextProfile);
    setProfileOpen(false);
  }

  async function handleStatusChange(orderId: string, status: Order["status"]) {
    const selected = orders.find((order) => order.id === orderId);
    await updateOrderStatusRemote(orderId, status, selected?.paymentConfirmed ?? false);
    updateOrderStatus(orderId, status, selected?.paymentConfirmed ?? false);
    void refreshAll();
  }

  async function handlePaymentConfirmation(orderId: string, confirmed: boolean) {
    const selected = orders.find((order) => order.id === orderId);
    await updateOrderStatusRemote(orderId, selected?.status || "novo", confirmed);
    updateOrderStatus(orderId, selected?.status || "novo", confirmed);
    void refreshAll();
  }

  function sendOrderToWhatsApp(order: Order) {
    const whatsapp = settings.whatsappNumber.replace(/\D/g, "");
    if (!whatsapp) return;
    window.open(`https://wa.me/55${whatsapp}?text=${buildWhatsAppMessage(order)}`, "_blank", "noopener,noreferrer");
  }

  function handleImageFile(file: File, target: "product" | "profile") {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (target === "product") {
        setProductForm((current) => ({ ...current, image: result }));
        return;
      }
      setProfileForm((current) => ({ ...current, profileImage: result }));
    };
    reader.readAsDataURL(file);
  }

  const commandButtons = (
    <div className="grid gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => {
            setActiveTab(tab.id);
            setMenuOpen(false);
          }}
          className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold ${activeTab === tab.id ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A] text-zinc-300"}`}
        >
          <span className="flex items-center gap-2">
            <tab.icon size={15} />
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-black px-4 py-7 text-white">
        <div className="mx-auto w-full max-w-sm rounded-2xl border border-[#1A1A1A] bg-[#080808] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight">Acesso Administrativo</h1>
              <p className="mt-1 text-xs text-zinc-400">Autentique para gerenciar produtos, pedidos e entregas.</p>
            </div>
            <div className="rounded-full border border-[#1A1A1A] p-2">
              <User size={15} />
            </div>
          </div>

          <form onSubmit={handleLogin} className="grid gap-2">
            <input value={authForm.username} onChange={(event) => setAuthForm((state) => ({ ...state, username: event.target.value }))} placeholder="Usuario" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
            <div className="relative">
              <input type={showLoginPassword ? "text" : "password"} value={authForm.password} onChange={(event) => setAuthForm((state) => ({ ...state, password: event.target.value }))} placeholder="Senha" className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 pr-10 text-sm" />
              <button type="button" onClick={() => setShowLoginPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {authError ? <p className="text-xs text-red-400">{authError}</p> : null}
            <button type="submit" className="rounded-xl bg-[#B2FF00] py-2 text-sm font-black text-black">Entrar no Painel</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-3 py-4 text-white sm:px-4 sm:py-5">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="hidden rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4 lg:block">
          <div className="mb-3 rounded-xl border border-[#1A1A1A] bg-black/50 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-[#1A1A1A] bg-black">
                {adminUser.profileImage ? <img src={adminUser.profileImage} alt={adminUser.name} className="h-full w-full object-cover" /> : <User size={18} />}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Solar Admin</p>
                <p className="mt-1 text-sm font-semibold">{adminUser.name}</p>
                <p className="text-xs text-zinc-400">@{adminUser.username}</p>
              </div>
            </div>
          </div>

          {commandButtons}

          <button type="button" onClick={() => setProfileOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] py-2 text-sm text-zinc-300">
            <Settings2 size={15} /> Perfil administrador
          </button>
          <button type="button" onClick={handleLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] py-2 text-sm text-zinc-300">
            <LogOut size={15} /> Sair
          </button>
        </aside>

        <section>
          <header className="mb-4 rounded-2xl border border-[#1A1A1A] bg-[#080808] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-[#1A1A1A] p-2"><ChartNoAxesColumn size={15} /></div>
                <div>
                  <h1 className="text-lg font-black tracking-tight sm:text-2xl">Painel Administrativo</h1>
                  <p className="text-xs text-zinc-400">Modulo: {activeTabLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href="/loja" className="rounded-xl border border-[#1A1A1A] px-3 py-2 text-xs hover:border-[#00AAFF] sm:text-sm">Abrir loja</a>
                <button type="button" onClick={() => setProfileOpen(true)} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-[#1A1A1A] bg-black" aria-label="Perfil do administrador">
                  {adminUser.profileImage ? <img src={adminUser.profileImage} alt={adminUser.name} className="h-full w-full object-cover" /> : <User size={16} />}
                </button>
                <button type="button" onClick={() => setMenuOpen((value) => !value)} className="rounded-xl border border-[#1A1A1A] p-2 lg:hidden" aria-label="Abrir comandos"><Menu size={16} /></button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[#1A1A1A] bg-black/60 px-2 py-2 text-center"><p className="text-[10px] uppercase text-zinc-500">Pedidos</p><p className="text-sm font-black">{orders.length}</p></div>
              <div className="rounded-xl border border-[#1A1A1A] bg-black/60 px-2 py-2 text-center"><p className="text-[10px] uppercase text-zinc-500">Produtos</p><p className="text-sm font-black">{products.length}</p></div>
              <div className="rounded-xl border border-[#1A1A1A] bg-black/60 px-2 py-2 text-center"><p className="text-[10px] uppercase text-zinc-500">Ticket medio</p><p className="text-sm font-black text-[#B2FF00]">{formatCurrency(averageTicket)}</p></div>
            </div>
          </header>

          {menuOpen ? <div className="mb-4 rounded-2xl border border-[#1A1A1A] bg-[#080808] p-3 lg:hidden">{commandButtons}</div> : null}

          <main className="space-y-4">
            {activeTab === "dashboard" && (
              <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4"><p className="text-xs uppercase text-zinc-500">Faturamento Hoje</p><p className="mt-2 text-2xl font-black text-[#B2FF00]">{formatCurrency(summary.revenueToday)}</p></article>
                  <article className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4"><p className="text-xs uppercase text-zinc-500">Pedidos Hoje</p><p className="mt-2 text-2xl font-black">{summary.ordersToday}</p></article>
                  <article className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4"><p className="text-xs uppercase text-zinc-500">Produtos Cadastrados Hoje</p><p className="mt-2 text-2xl font-black">{summary.productsToday}</p></article>
                  <article className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4"><p className="text-xs uppercase text-zinc-500">Itens Vendidos</p><p className="mt-2 text-2xl font-black text-[#00AAFF]">{totalItemsSold}</p></article>
                </section>
              </>
            )}

            {activeTab === "produtos" && (
              <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                <form onSubmit={handleCreateProduct} className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                  <h2 className="text-lg font-bold">Cadastro de Produto</h2>
                  <p className="mt-1 text-xs text-zinc-400">Selecione imagem do aparelho, categoria e publique no carrinho.</p>
                  <div className="mt-3 grid gap-2">
                    <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do produto" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                    <input value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} placeholder="Preco" type="number" step="0.01" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                    <input ref={productImageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleImageFile(file, "product"); }} />
                    <button type="button" onClick={() => productImageInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"><ImagePlus size={16} /> Selecionar imagem</button>
                    {productForm.image ? <img src={productForm.image} alt="Preview" className="h-28 w-full rounded-xl object-cover" /> : null}
                    <select value={productForm.category} onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))} className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm">
                      {settings.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <button type="submit" className="rounded-xl bg-[#B2FF00] py-2 font-black text-black">Salvar Produto</button>
                  </div>
                </form>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                    <h2 className="text-lg font-bold">Categorias</h2>
                    <div className="mt-3 flex gap-2">
                      <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Nova categoria" className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <button type="button" onClick={handleAddCategory} className="rounded-xl bg-[#00AAFF] px-4 py-2 text-sm font-black text-black">Adicionar</button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">{settings.categories.map((category) => <span key={category} className="rounded-full border border-[#1A1A1A] px-3 py-1 text-xs text-zinc-300">{category}</span>)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                    <h2 className="text-lg font-bold">Chave Pix e WhatsApp</h2>
                    <div className="mt-3 grid gap-2">
                      <input value={settings.pixKey} onChange={(event) => setSettings((current) => ({ ...current, pixKey: event.target.value }))} placeholder="Chave Pix" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <input value={settings.whatsappNumber} onChange={(event) => setSettings((current) => ({ ...current, whatsappNumber: event.target.value }))} placeholder="Numero do WhatsApp da empresa" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <button type="button" onClick={handleSaveSettings} className="rounded-xl bg-[#B2FF00] py-2 font-black text-black">Salvar Configuracoes</button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "pedidos" && (
              <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
                <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                  <h2 className="text-lg font-bold">Pedidos Recebidos</h2>
                  <div className="mt-3 space-y-3">
                    {orders.length === 0 ? <p className="text-sm text-zinc-500">Nenhum pedido ainda.</p> : orders.map((order) => (
                      <button key={order.id} type="button" onClick={() => setSelectedOrderId(order.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${selectedOrderId === order.id ? "border-[#B2FF00] bg-[#B2FF00]/5" : "border-[#1A1A1A]"}`}>
                        <div className="flex items-center justify-between"><p className="font-semibold">Pedido #{order.id.slice(0, 8)}</p><span className="rounded-full border border-[#1A1A1A] px-2 py-0.5 text-[11px] uppercase text-zinc-400">{order.status}</span></div>
                        <p className="mt-1 text-zinc-400">Cliente: {order.customer.fullName}</p>
                        <p className="text-zinc-400">Pagamento: {order.paymentMethod}</p>
                        <p className="text-zinc-400">Atendimento: {order.fulfillmentMethod}</p>
                        <p className="mt-1 text-[#B2FF00]">{formatCurrency(order.total)}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                  <h2 className="text-lg font-bold">Enviar para WhatsApp</h2>
                  {selectedOrder ? (
                    <>
                      <div className="mt-3 rounded-xl border border-[#1A1A1A] p-3 text-sm">
                        <p className="font-semibold">{selectedOrder.customer.fullName}</p>
                        <p className="text-zinc-400">{selectedOrder.customer.address || "Retirada no local"}</p>
                        <p className="mt-2 text-zinc-400">Pagamento: {selectedOrder.paymentMethod}</p>
                        <p className="text-zinc-400">Atendimento: {selectedOrder.fulfillmentMethod}</p>
                      </div>
                      <button type="button" onClick={() => sendOrderToWhatsApp(selectedOrder)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2 font-black text-black"><MessageCircle size={16} /> Enviar pedido selecionado</button>
                    </>
                  ) : <p className="mt-3 text-sm text-zinc-500">Selecione um pedido para montar a mensagem correta.</p>}
                </div>
              </section>
            )}

            {activeTab === "entregas" && (
              <section className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                <h2 className="text-lg font-bold">Incremento de Entrega e Status</h2>
                <div className="mt-3 space-y-3">
                  {deliveries.length === 0 ? <p className="text-sm text-zinc-500">Sem pedidos para entrega.</p> : deliveries.map((delivery) => (
                    <article key={delivery.id} className="rounded-xl border border-[#1A1A1A] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">#{delivery.id.slice(0, 8)} - {delivery.customer.fullName}</p>
                          <p className="text-zinc-400">{delivery.customer.address}</p>
                        </div>
                        <span className="rounded-full border border-[#1A1A1A] px-2 py-0.5 text-[11px] uppercase text-zinc-400">{delivery.status}</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_140px]">
                        <select value={delivery.status} onChange={(event) => handleStatusChange(delivery.id, event.target.value as Order["status"])} className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm">
                          <option value="novo">Novo</option>
                          <option value="separando">Separando</option>
                          <option value="separado">Separado</option>
                          <option value="em_rota">Pedido enviado para entrega</option>
                          <option value="entregue">Entregue</option>
                          <option value="retirada_disponivel">Retirada disponivel</option>
                        </select>
                        <button type="button" onClick={() => handlePaymentConfirmation(delivery.id, !delivery.paymentConfirmed)} className={`rounded-xl border px-3 py-2 text-sm ${delivery.paymentConfirmed ? "border-[#B2FF00] text-[#B2FF00]" : "border-[#1A1A1A] text-zinc-300"}`}>{delivery.paymentConfirmed ? "Pagamento OK" : "Confirmar pagamento"}</button>
                        <button type="button" onClick={() => sendOrderToWhatsApp(delivery)} className="rounded-xl bg-[#25D366] px-3 py-2 text-sm font-black text-black">WhatsApp</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </main>
        </section>
      </div>

      {profileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setProfileOpen(false)}>
          <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Perfil do Administrador</h3>
              <button type="button" onClick={() => setProfileOpen(false)} className="rounded-full border border-[#1A1A1A] p-1.5"><X size={15} /></button>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-[#1A1A1A] bg-black">
                  {profileForm.profileImage ? <img src={profileForm.profileImage} alt={profileForm.name} className="h-full w-full object-cover" /> : <User size={22} />}
                </div>
                <div className="flex-1">
                  <input ref={profileImageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleImageFile(file, "profile"); }} />
                  <button type="button" onClick={() => profileImageInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] py-2 text-sm"><ImagePlus size={15} /> Upload de imagem</button>
                </div>
              </div>
              <input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do administrador" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
              <input value={profileForm.username} onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))} placeholder="Usuario" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
              <div className="relative">
                <input type={showProfilePassword ? "text" : "password"} value={profileForm.password} onChange={(event) => setProfileForm((current) => ({ ...current, password: event.target.value }))} placeholder="Nova senha" className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 pr-10 text-sm" />
                <button type="button" onClick={() => setShowProfilePassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">{showProfilePassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <button type="button" onClick={handleSaveProfile} className="rounded-xl bg-[#B2FF00] py-2 font-black text-black">Salvar perfil</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
