"use client";

import {
  clearCustomerSessionRemote,
  getCustomerSessionRemote,
  getCustomerAlertsRemote,
  getAdminSettingsRemote,
  markCustomerAlertAsReadRemote,
  getOrdersForAdmin,
  getProductsCatalog,
  loginCustomerRemote,
  postOrder,
  registerCustomerRemote,
  uploadOrderPixProofRemote,
  updateCustomerAccountRemote,
} from "@/lib/api";
import { AdminSettings, CartItem, CustomerAccount, CustomerProfile, Order, Product } from "@/types/domain";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  MapPin,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Upload,
  User,
  X,
  Bell,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CustomerAlert } from "@/types/domain";

const profileDefault: CustomerProfile = {
  fullName: "",
  cpf: "",
  phone: "",
  address: "",
  street: "",
  number: "",
  reference: "",
};

type CheckoutStep = 1 | 2 | 3 | 4;
type CategoryFilter = "todos" | "carnes" | "bebidas" | "hortfruit";

type PaymentMethod = Order["paymentMethod"];
type FulfillmentMethod = Order["fulfillmentMethod"];
const DEFAULT_DELIVERY_MINIMUM = 150;
const DEFAULT_PICKUP_MINIMUM = 100;

const displayCategories: Array<{ key: Exclude<CategoryFilter, "todos">; label: string }> = [
  { key: "carnes", label: "Carnes" },
  { key: "bebidas", label: "Bebidas" },
  { key: "hortfruit", label: "Hortfruit" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28 } },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getStatusMessage(status: Order["status"], fulfillmentMethod: Order["fulfillmentMethod"]) {
  if (status === "separando") return "Seu pedido esta sendo separado.";
  if (status === "separado") return fulfillmentMethod === "retirada" ? "Seu pedido esta separado para retirada." : "Seu pedido foi separado.";
  if (status === "em_rota") return "Seu pedido foi enviado para entrega.";
  if (status === "entregue") return "Seu pedido foi entregue com sucesso.";
  if (status === "retirada_disponivel") return "Seu pedido esta disponivel para retirada.";
  return "Seu pedido foi recebido e esta aguardando processamento.";
}

function getSectionName(rawCategory: string) {
  const normalized = rawCategory.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (normalized.includes("mercearia") || normalized.includes("arroz") || normalized.includes("feijao") || normalized.includes("cereal")) return "Cereais";
  if (normalized.includes("carn")) return "Carnes";
  if (normalized.includes("bebida") || normalized.includes("suco") || normalized.includes("refrigerante")) return "Bebidas";
  if (normalized.includes("hort") || normalized.includes("fruta") || normalized.includes("verdura") || normalized.includes("legume")) return "Hortfruit";
  if (normalized.includes("limpeza")) return "Limpeza";
  return "Outros";
}

export default function StorefrontClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({
    pixKey: "",
    whatsappNumber: "",
    categories: [],
    deliveryMinimum: DEFAULT_DELIVERY_MINIMUM,
    pickupMinimum: DEFAULT_PICKUP_MINIMUM,
    cashbackSpendThreshold: 0,
    cashbackRewardValue: 0,
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todos");
  const [categorySidebarOpen, setCategorySidebarOpen] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile>(profileDefault);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<CheckoutStep>(1);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [copyDone, setCopyDone] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>("entrega");
  const [accountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "cadastro">("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [customerSession, setCustomerSession] = useState<CustomerAccount | null>(null);
  const [customerAlerts, setCustomerAlerts] = useState<CustomerAlert[]>([]);
  const [whatsAppDraftMessage, setWhatsAppDraftMessage] = useState("");
  const knownUnreadAlertIdsRef = useRef<Set<string>>(new Set());
  const alertBootstrapDoneRef = useRef(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastPixOrder, setLastPixOrder] = useState<Order | null>(null);
  const [pixFlowOpen, setPixFlowOpen] = useState(false);
  const [pixProofFile, setPixProofFile] = useState<File | null>(null);
  const [pixProofUploading, setPixProofUploading] = useState(false);
  const [pixProofFeedback, setPixProofFeedback] = useState("");
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    phone: "",
    cpf: "",
    password: "",
    street: "",
    number: "",
    reference: "",
  });

  useEffect(() => {
    const loadRemoteState = async () => {
      const session = await getCustomerSessionRemote();
      setCustomerSession(session);
      if (session) {
        setProfile({
          fullName: session.fullName,
          cpf: session.cpf,
          phone: session.phone,
          address: "",
          street: session.street || "",
          number: session.number || "",
          reference: session.reference || "",
        });
      }
      setProducts(await getProductsCatalog());
      setSettings(await getAdminSettingsRemote());
      setOrders(await getOrdersForAdmin());
    };

    void loadRemoteState();

    const syncOrders = () => {
      void loadRemoteState();
    };

    const intervalId = window.setInterval(syncOrders, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!customerSession) return;
    setProfile({
      fullName: customerSession.fullName,
      cpf: customerSession.cpf,
      phone: customerSession.phone,
      address: "",
      street: customerSession.street || "",
      number: customerSession.number || "",
      reference: customerSession.reference || "",
    });
  }, [customerSession]);

  useEffect(() => {
    if (!customerSession?.id) {
      setCustomerAlerts([]);
      knownUnreadAlertIdsRef.current = new Set();
      alertBootstrapDoneRef.current = false;
      return;
    }

    let canceled = false;

    const loadAlerts = async () => {
      const alerts = await getCustomerAlertsRemote(customerSession.id);
      if (!canceled) {
        setCustomerAlerts(alerts);
      }
    };

    void loadAlerts();
    const interval = window.setInterval(() => {
      void loadAlerts();
    }, 5000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [customerSession?.id]);

  function playAlertFeedback() {
    if (typeof window === "undefined") return;

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([120, 60, 120]);
    }

    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.26);

      window.setTimeout(() => {
        void ctx.close();
      }, 320);
    } catch {
      // Ignore audio feedback errors on unsupported devices.
    }
  }

  useEffect(() => {
    const unreadAlerts = customerAlerts.filter((alert) => !alert.readAt);
    const unreadIds = new Set(unreadAlerts.map((alert) => alert.id));

    if (alertBootstrapDoneRef.current) {
      const hasNewUnread = unreadAlerts.some((alert) => !knownUnreadAlertIdsRef.current.has(alert.id));
      if (hasNewUnread) {
        playAlertFeedback();
      }
    } else {
      alertBootstrapDoneRef.current = true;
    }

    knownUnreadAlertIdsRef.current = unreadIds;
  }, [customerAlerts]);

  async function handleMarkAlertAsRead(alertId: string) {
    if (!customerSession?.id) return;
    const selectedAlert = customerAlerts.find((alert) => alert.id === alertId);
    const ok = await markCustomerAlertAsReadRemote(customerSession.id, alertId);
    if (!ok) return;
    const alerts = await getCustomerAlertsRemote(customerSession.id);
    setCustomerAlerts(alerts);

    if (selectedAlert) {
      const draft = [
        `Olá, sou ${customerSession.fullName}.`,
        "Vi o alerta no app e gostaria de falar com o administrador.",
        `Assunto: ${selectedAlert.title}`,
        selectedAlert.message,
      ].join("\n");
      setWhatsAppDraftMessage(draft);
    }
  }

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

  const deliveryMinimum = Number.isFinite(settings.deliveryMinimum) ? Number(settings.deliveryMinimum) : DEFAULT_DELIVERY_MINIMUM;
  const pickupMinimum = Number.isFinite(settings.pickupMinimum) ? Number(settings.pickupMinimum) : DEFAULT_PICKUP_MINIMUM;
  const isDeliveryUnlocked = total >= deliveryMinimum;
  const missingForDelivery = Math.max(0, deliveryMinimum - total);
  const isPickupUnlocked = total >= pickupMinimum;
  const missingForPickup = Math.max(0, pickupMinimum - total);

  useEffect(() => {
    if (!isDeliveryUnlocked && fulfillmentMethod === "entrega") {
      setFulfillmentMethod("retirada");
    }
  }, [fulfillmentMethod, isDeliveryUnlocked]);

  function normalizeCategory(raw: string): Exclude<CategoryFilter, "todos"> | null {
    const normalized = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (normalized.includes("carn")) return "carnes";
    if (normalized.includes("bebida") || normalized.includes("suco") || normalized.includes("refrigerante")) return "bebidas";
    if (normalized.includes("hort") || normalized.includes("fruta") || normalized.includes("verdura") || normalized.includes("legume")) return "hortfruit";
    return null;
  }

  const searchedProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm);
      if (!matchSearch) return false;
      if (categoryFilter === "todos") return true;
      return normalizeCategory(product.category) === categoryFilter;
    });
  }, [products, search, categoryFilter]);

  const sectionedProducts = useMemo(() => {
    const order = ["Cereais", "Carnes", "Bebidas", "Hortfruit", "Limpeza", "Outros"];
    const groups = new Map<string, Product[]>();

    searchedProducts.forEach((product) => {
      const section = getSectionName(product.category);
      const list = groups.get(section) || [];
      list.push(product);
      groups.set(section, list);
    });

    return order.map((name) => ({ name, items: groups.get(name) || [] })).filter((section) => section.items.length > 0);
  }, [searchedProducts]);

  const latestTrackedOrder = useMemo(() => {
    if (lastOrderId) {
      return orders.find((order) => order.id === lastOrderId) || null;
    }

    if (customerSession) {
      return orders.find((order) => order.customerId === customerSession.id) || null;
    }

    if (profile.phone.trim()) {
      return orders.find((order) => order.customer.phone === profile.phone.trim()) || null;
    }

    return null;
  }, [customerSession, lastOrderId, orders, profile.phone]);

  const unreadAlerts = useMemo(() => customerAlerts.filter((alert) => !alert.readAt), [customerAlerts]);
  const topUnreadAlert = unreadAlerts[0] || null;

  function addToCart(productId: string) {
    setCart((prev) => {
      const index = prev.findIndex((item) => item.productId === productId);
      if (index === -1) return [...prev, { productId, quantity: 1 }];
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].quantity + 1 };
      return next;
    });
    setCheckoutError("");
  }

  function decrementFromCart(productId: string) {
    setCart((prev) => {
      const index = prev.findIndex((item) => item.productId === productId);
      if (index === -1) return prev;
      const next = [...prev];
      const newQty = next[index].quantity - 1;
      if (newQty <= 0) {
        next.splice(index, 1);
        return next;
      }
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    if (editItemId === productId) setEditItemId(null);
  }

  const canAdvanceToAddress = cart.length > 0;
  const canAdvanceToDelivery = Boolean(profile.fullName.trim() && profile.phone.trim());
  const canAdvanceToReview = fulfillmentMethod === "retirada" ? isPickupUnlocked : isDeliveryUnlocked && Boolean(profile.street?.trim());

  async function copyPixKey() {
    if (!settings.pixKey) return;
    try {
      await navigator.clipboard.writeText(settings.pixKey);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1600);
    } catch {
      setCopyDone(false);
    }
  }

  function openCompanyWhatsApp() {
    const phone = settings.whatsappNumber.replace(/\D/g, "");
    if (!phone) return;
    const waPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const suffix = whatsAppDraftMessage ? `?text=${encodeURIComponent(whatsAppDraftMessage)}` : "";
    window.open(`https://wa.me/${waPhone}${suffix}`, "_blank", "noopener,noreferrer");
  }

  function openPixProofWhatsApp(order: Order) {
    const phone = settings.whatsappNumber.replace(/\D/g, "");
    if (!phone) return;
    const waPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const message = [
      "Enviar comprovante de pagamento para processar/separar o pedido.",
      `Pedido: #${order.id.slice(0, 8)}`,
      `Cliente: ${order.customer.fullName}`,
      `Total: ${formatCurrency(order.total)}`,
    ].join("\n");
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  function buildPixReceiptContent(order: Order) {
    const lines = [
      "COMPROVANTE PIX - SOLAR SUPERMERCADO",
      `Pedido: ${order.id}`,
      `Data: ${new Date(order.createdAt).toLocaleString("pt-BR")}`,
      `Cliente: ${order.customer.fullName}`,
      `Telefone: ${order.customer.phone}`,
      `Pagamento: PIX`,
      `Atendimento: ${order.fulfillmentMethod === "entrega" ? "Entrega" : "Retirada"}`,
      `Valor total: ${formatCurrency(order.total)}`,
      `Chave Pix: ${settings.pixKey || "Nao definida"}`,
      "",
      "Itens:",
      ...order.items.map((item) => `${item.quantity}x ${item.name} - ${formatCurrency(item.unitPrice * item.quantity)}`),
    ];
    return lines.join("\n");
  }

  function downloadPixReceipt(order: Order) {
    const content = buildPixReceiptContent(order);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comprovante-pix-${order.id.slice(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleSendPixProof() {
    if (!lastPixOrder?.id || !pixProofFile) {
      setPixProofFeedback("Selecione o comprovante para enviar ao painel.");
      return;
    }

    const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });

    try {
      setPixProofUploading(true);
      const dataUrl = await toDataUrl(pixProofFile);
      const updatedOrder = await uploadOrderPixProofRemote(lastPixOrder.id, pixProofFile.name, dataUrl);
      if (!updatedOrder) {
        setPixProofFeedback("Nao foi possivel enviar o comprovante. Tente novamente.");
        return;
      }
      setLastPixOrder(updatedOrder);
      setOrders(await getOrdersForAdmin());
      setPixProofFeedback("Comprovante enviado com sucesso para analise do admin.");
      setPixProofFile(null);
    } catch {
      setPixProofFeedback("Nao foi possivel enviar o comprovante. Tente novamente.");
    } finally {
      setPixProofUploading(false);
    }
  }

  async function submitOrder() {
    if (!cart.length) return;

    const fullAddress = fulfillmentMethod === "retirada"
      ? "Retirada no mercado"
      : [profile.street?.trim(), profile.number?.trim() ? `N ${profile.number.trim()}` : "", profile.reference?.trim() ? `Ref: ${profile.reference.trim()}` : ""]
          .filter(Boolean)
          .join(" | ");

    if (!profile.fullName.trim() || !profile.phone.trim()) {
      setCheckoutError("Preencha nome e telefone para finalizar.");
      return;
    }

    if (fulfillmentMethod === "entrega" && !isDeliveryUnlocked) {
      setCheckoutError(`Entrega disponivel somente para pedidos a partir de ${formatCurrency(deliveryMinimum)}.`);
      return;
    }

    if (fulfillmentMethod === "retirada" && !isPickupUnlocked) {
      setCheckoutError(`Retirada disponivel somente para pedidos a partir de ${formatCurrency(pickupMinimum)}.`);
      return;
    }

    if (fulfillmentMethod === "entrega" && !profile.street?.trim()) {
      setCheckoutError("Preencha o endereco para entrega.");
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
      customer: {
        ...profile,
        address: fullAddress,
      },
      total,
      status: "novo",
      paymentMethod,
      fulfillmentMethod,
      paymentConfirmed: paymentMethod !== "pix",
      customerId: customerSession?.id,
      createdAt: new Date().toISOString(),
    };

    await postOrder(order);

    if (order.paymentMethod === "pix") {
      setLastPixOrder(order);
      setPixFlowOpen(true);
      setPixProofFile(null);
      setPixProofFeedback("");
    } else {
      setLastPixOrder(null);
      setPixFlowOpen(false);
    }

    if (customerSession) {
      const updatedAccount: CustomerAccount = {
        ...customerSession,
        fullName: profile.fullName,
        phone: profile.phone,
        cpf: profile.cpf,
        street: profile.street,
        number: profile.number,
        reference: profile.reference,
      };
      const syncedAccount = await updateCustomerAccountRemote(updatedAccount);
      setCustomerSession(syncedAccount);
    }

    setCart([]);
    setStep(1);
    setCartOpen(false);
    setCheckoutDone(true);
    setLastOrderId(order.id);
    setCheckoutError("");
    setPaymentMethod("pix");
    setFulfillmentMethod("entrega");
    setOrders(await getOrdersForAdmin());
    if (!customerSession) {
      setProfile(profileDefault);
    }
    window.setTimeout(() => setCheckoutDone(false), 2800);
  }

  async function handleCustomerLogin(event: React.FormEvent) {
    event.preventDefault();
    const account = await loginCustomerRemote(loginForm.phone, loginForm.password);
    if (!account) {
      setAuthError("Telefone ou senha invalidos.");
      return;
    }
    setCustomerSession(account);
    setAuthError("");
    setAccountOpen(false);
    setLoginForm({ phone: "", password: "" });
  }

  async function handleCustomerRegister(event: React.FormEvent) {
    event.preventDefault();
    if (!registerForm.fullName.trim() || !registerForm.phone.trim() || !registerForm.password.trim()) {
      setAuthError("Preencha nome, telefone e senha para cadastrar.");
      return;
    }

    const account: CustomerAccount = {
      id: crypto.randomUUID(),
      fullName: registerForm.fullName,
      phone: registerForm.phone,
      cpf: registerForm.cpf,
      password: registerForm.password,
      street: registerForm.street,
      number: registerForm.number,
      reference: registerForm.reference,
      cashbackBalance: 0,
    };

    const savedAccount = await registerCustomerRemote(account);
    setCustomerSession(savedAccount);
    setProfile({
      fullName: savedAccount.fullName,
      cpf: savedAccount.cpf,
      phone: savedAccount.phone,
      address: "",
      street: savedAccount.street || "",
      number: savedAccount.number || "",
      reference: savedAccount.reference || "",
    });
    setAuthError("");
    setAccountOpen(false);
    setRegisterForm({ fullName: "", phone: "", cpf: "", password: "", street: "", number: "", reference: "" });
  }

  function handleCustomerLogout() {
    void clearCustomerSessionRemote();
    setCustomerSession(null);
    setAuthError("");
  }

  return (
    <div className="min-h-screen bg-black pb-36 text-white">
      <header className="sticky top-0 z-30 border-b border-[#1A1A1A] bg-black/85 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-2">
          <button
            type="button"
            onClick={() => setCategorySidebarOpen(true)}
            className="grid h-12 w-28 place-items-center overflow-hidden rounded-xl border border-[#1A1A1A] bg-black px-1"
            aria-label="Abrir categorias"
          >
            <img
              src="/logo-solar-wordmark.svg"
              alt="Solar Supermercado"
              className="block h-full w-full object-contain"
            />
          </button>

          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto" className="w-full rounded-xl border border-[#1A1A1A] bg-black py-2 pl-9 pr-3 text-sm" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setAccountOpen(true)} className="rounded-full border border-[#1A1A1A] p-2" aria-label="Perfil">
              <User size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCartOpen(true);
                setStep(1);
                setCheckoutError("");
              }}
              className="relative rounded-full bg-[#B2FF00] p-2 text-black"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#00AAFF] text-xs font-bold text-black">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pt-4">
        {customerSession ? (
          <div className="mb-4 rounded-2xl border border-[#1A1A1A] bg-[#080808] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Conta cliente</p>
                <p className="mt-1 text-sm font-semibold">{customerSession.fullName}</p>
                <p className="text-xs text-[#B2FF00]">Cashback disponivel: {formatCurrency(customerSession.cashbackBalance)}</p>
              </div>
              <button type="button" onClick={handleCustomerLogout} className="rounded-xl border border-[#1A1A1A] px-3 py-2 text-xs text-zinc-300">Sair</button>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-2xl border border-[#1A1A1A] bg-[#080808] p-3 text-sm text-zinc-300">
            Entre na sua conta para acumular cashback ou finalize como convidado.
          </div>
        )}

        {customerSession && topUnreadAlert ? (
          <div className="mb-4 rounded-xl border border-[#2A5C35] bg-[#0B2418] px-3 py-2">
            <div className="flex items-start gap-2">
              <Bell size={14} className="mt-0.5 text-[#B2FF00]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#B2FF00]">Novo alerta</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{topUnreadAlert.title}</p>
                <p className="line-clamp-2 text-xs text-zinc-300">{topUnreadAlert.message}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleMarkAlertAsRead(topUnreadAlert.id)}
                className="rounded-lg border border-[#B2FF00] px-2 py-1 text-[10px] font-semibold text-[#B2FF00]"
              >
                Lido
              </button>
            </div>
            {whatsAppDraftMessage ? (
              <p className="mt-2 text-[11px] text-[#9BFFD1]">Mensagem pronta para WhatsApp. Toque no icone verde para falar com o administrador.</p>
            ) : null}
          </div>
        ) : null}

        {latestTrackedOrder ? (
          <div className="mb-4 rounded-2xl border border-[#1A1A1A] bg-[#080808] p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Status do pedido</p>
            <p className="mt-1 text-sm font-semibold text-[#B2FF00]">{getStatusMessage(latestTrackedOrder.status, latestTrackedOrder.fulfillmentMethod)}</p>
            <p className="mt-1 text-xs text-zinc-400">Pedido #{latestTrackedOrder.id.slice(0, 8)} • pagamento {latestTrackedOrder.paymentConfirmed ? "confirmado" : "pendente"}</p>
            {latestTrackedOrder.paymentMethod === "pix" && !latestTrackedOrder.paymentConfirmed ? (
              <button
                type="button"
                onClick={() => {
                  setLastPixOrder(latestTrackedOrder);
                  setPixFlowOpen(true);
                  setPixProofFeedback("");
                }}
                className="mt-2 w-full rounded-xl border border-[#1A1A1A] py-2 text-xs text-zinc-300"
              >
                Enviar ou reenviar comprovante Pix
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4">
          {sectionedProducts.map((section) => (
            <section key={section.name} className="rounded-2xl border border-white/10 bg-[#080808] p-2.5">
              <div className="mb-2 flex items-center gap-2 px-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300">{section.name}</p>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
                {section.items.map((product) => (
                  <motion.article key={product.id} variants={itemVariants} whileHover={{ y: -5, scale: 1.01 }} className="group overflow-hidden rounded-2xl border border-[#1A1A1A] bg-[#080808] shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
                    <div className="relative">
                      <img src={product.image} alt={product.name} className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                      {quantityMap.get(product.id) ? <div className="absolute right-2 top-2 rounded-full bg-[#B2FF00] px-2 py-0.5 text-[10px] font-black text-black">{quantityMap.get(product.id)} no carrinho</div> : null}
                    </div>
                    <div className="p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{product.category}</p>
                      <h2 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{product.name}</h2>
                      <div className="mt-2 flex items-center justify-between">
                        <strong className="text-sm font-black text-[#B2FF00]">{formatCurrency(product.price)}</strong>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => decrementFromCart(product.id)} className="grid h-7 w-7 place-items-center rounded-full border border-[#1A1A1A]" aria-label="Diminuir"><Minus size={13} /></button>
                          <button type="button" onClick={() => addToCart(product.id)} className="grid h-7 w-7 place-items-center rounded-full bg-[#00AAFF] text-black" aria-label="Adicionar"><Plus size={13} /></button>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            </section>
          ))}
        </div>

        {searchedProducts.length === 0 ? <p className="mt-4 rounded-xl border border-[#1A1A1A] bg-[#080808] px-3 py-3 text-center text-sm text-zinc-500">Nenhum produto encontrado com esse termo de busca.</p> : null}
      </main>

      <AnimatePresence>
        {accountOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setAccountOpen(false)}>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-[#1A1A1A] bg-[#080808] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black">Conta do Cliente</h3>
                  <p className="mt-1 text-xs text-zinc-500">Use conta para cashback ou siga como convidado no checkout.</p>
                </div>
                <button type="button" onClick={() => setAccountOpen(false)} className="rounded-full border border-[#1A1A1A] p-1.5"><X size={15} /></button>
              </div>

              {customerSession ? (
                <div className="mt-4 rounded-2xl border border-[#1A1A1A] bg-black p-4 text-sm">
                  <p className="font-semibold">{customerSession.fullName}</p>
                  <p className="mt-1 text-zinc-400">{customerSession.phone}</p>
                  <p className="mt-2 text-[#B2FF00]">Cashback: {formatCurrency(customerSession.cashbackBalance)}</p>
                  <button type="button" onClick={handleCustomerLogout} className="mt-3 w-full rounded-xl border border-[#1A1A1A] py-2">Sair da conta</button>
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setAuthMode("login"); setAuthError(""); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${authMode === "login" ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A]"}`}>Entrar</button>
                    <button type="button" onClick={() => { setAuthMode("cadastro"); setAuthError(""); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${authMode === "cadastro" ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A]"}`}>Cadastrar</button>
                  </div>

                  {authMode === "login" ? (
                    <form onSubmit={handleCustomerLogin} className="mt-4 grid gap-2">
                      <input value={loginForm.phone} onChange={(event) => setLoginForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefone" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <div className="relative">
                        <input type={showLoginPassword ? "text" : "password"} value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} placeholder="Senha" className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 pr-10 text-sm" />
                        <button type="button" onClick={() => setShowLoginPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">{showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                      <button type="submit" className="rounded-xl bg-[#B2FF00] py-2 font-black text-black">Entrar</button>
                    </form>
                  ) : (
                    <form onSubmit={handleCustomerRegister} className="mt-4 grid gap-2">
                      <input value={registerForm.fullName} onChange={(event) => setRegisterForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nome completo" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <input value={registerForm.phone} onChange={(event) => setRegisterForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefone" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <input value={registerForm.cpf} onChange={(event) => setRegisterForm((current) => ({ ...current, cpf: event.target.value }))} placeholder="CPF" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <div className="relative">
                        <input type={showRegisterPassword ? "text" : "password"} value={registerForm.password} onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))} placeholder="Senha" className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 pr-10 text-sm" />
                        <button type="button" onClick={() => setShowRegisterPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">{showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                      <input value={registerForm.street} onChange={(event) => setRegisterForm((current) => ({ ...current, street: event.target.value }))} placeholder="Rua" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={registerForm.number} onChange={(event) => setRegisterForm((current) => ({ ...current, number: event.target.value }))} placeholder="Numero" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                        <input value={registerForm.reference} onChange={(event) => setRegisterForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Referencia" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      </div>
                      <button type="submit" className="rounded-xl bg-[#B2FF00] py-2 font-black text-black">Criar conta</button>
                    </form>
                  )}
                </>
              )}

              {authError ? <p className="mt-3 text-xs text-red-400">{authError}</p> : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categorySidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70" onClick={() => setCategorySidebarOpen(false)}>
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 280, damping: 28 }} onClick={(event) => event.stopPropagation()} className="h-full w-[84%] max-w-xs border-r border-[#1A1A1A] bg-[#080808] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-black">Categorias</h3>
                <button type="button" onClick={() => setCategorySidebarOpen(false)} className="rounded-full border border-[#1A1A1A] p-1.5" aria-label="Fechar categorias"><X size={15} /></button>
              </div>
              <div className="grid gap-2">
                <button type="button" onClick={() => { setCategoryFilter("todos"); setCategorySidebarOpen(false); }} className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${categoryFilter === "todos" ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A] text-zinc-300"}`}>Todos</button>
                {displayCategories.map((category) => (
                  <button key={category.key} type="button" onClick={() => { setCategoryFilter(category.key); setCategorySidebarOpen(false); }} className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${categoryFilter === category.key ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A] text-zinc-300"}`}>{category.label}</button>
                ))}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/70" onClick={() => setCartOpen(false)}>
            <motion.aside initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 24 }} onClick={(event) => event.stopPropagation()} className="absolute bottom-0 left-0 right-0 rounded-t-3xl border border-[#1A1A1A] bg-[#080808] p-4 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
              <h3 className="text-lg font-bold">Checkout Passo a Passo</h3>
              <p className="mt-1 text-xs text-zinc-500">Etapa {step}/4</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((dot) => <div key={dot} className={`h-1.5 rounded-full ${step >= dot ? "bg-[#B2FF00]" : "bg-[#1A1A1A]"}`} />)}
              </div>

              {step === 1 && (
                <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-3">
                  <p className="mb-2 text-sm font-semibold">Verifique os produtos</p>
                  <div className={`mb-2 rounded-xl border px-3 py-2 text-xs ${isDeliveryUnlocked ? "border-[#123A24] bg-[#0B2418] text-[#9BFFD1]" : "border-[#3B2A00] bg-[#2A1E00] text-[#FFD98A]"}`}>
                    {isDeliveryUnlocked
                      ? `Entrega desbloqueada para este pedido.`
                      : `Faltam ${formatCurrency(missingForDelivery)} para liberar entrega (minimo ${formatCurrency(deliveryMinimum)}).`}
                  </div>
                  <div className="max-h-48 overflow-auto">
                    {cart.length === 0 ? <p className="text-sm text-zinc-500">Nenhum item selecionado.</p> : cart.map((item) => {
                      const product = products.find((p) => p.id === item.productId);
                      if (!product) return null;
                      const editing = editItemId === item.productId;
                      return (
                        <div key={item.productId} className="mb-2 rounded-xl border border-[#1A1A1A] p-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="line-clamp-1">{product.name}</span>
                            <span>{formatCurrency(product.price * item.quantity)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-zinc-400">Qtd: {item.quantity}</span>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setEditItemId(editing ? null : item.productId)} className="grid h-7 w-7 place-items-center rounded-full border border-[#1A1A1A]" aria-label="Editar quantidade"><Pencil size={13} /></button>
                              <button type="button" onClick={() => removeFromCart(item.productId)} className="grid h-7 w-7 place-items-center rounded-full border border-[#1A1A1A] text-red-400" aria-label="Remover item"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          {editing ? (
                            <div className="mt-2 flex items-center gap-2">
                              <button type="button" onClick={() => decrementFromCart(product.id)} className="grid h-7 w-7 place-items-center rounded-full border border-[#1A1A1A]"><Minus size={13} /></button>
                              <span className="w-7 text-center text-xs font-semibold">{item.quantity}</span>
                              <button type="button" onClick={() => addToCart(product.id)} className="grid h-7 w-7 place-items-center rounded-full bg-[#00AAFF] text-black"><Plus size={13} /></button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 rounded-xl border border-[#1A1A1A] bg-black p-3">
                    <p className="text-xs text-zinc-400">Total do pedido</p>
                    <p className="text-lg font-black text-[#B2FF00]">{formatCurrency(total)}</p>
                  </div>
                  <button type="button" onClick={() => setStep(2)} disabled={!canAdvanceToAddress} className="mt-3 w-full rounded-xl bg-[#B2FF00] py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-45">Proximo</button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-3 rounded-xl border border-[#1A1A1A] bg-black p-3">
                  <p className="flex items-center gap-1 text-xs text-zinc-400"><User size={14} /> Dados do cliente</p>
                  <input placeholder="Nome completo" value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#1A1A1A] bg-[#080808] px-3 py-2 text-sm" />
                  <input placeholder="Telefone" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#1A1A1A] bg-[#080808] px-3 py-2 text-sm" />
                  <input placeholder="CPF (opcional)" value={profile.cpf} onChange={(event) => setProfile((current) => ({ ...current, cpf: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#1A1A1A] bg-[#080808] px-3 py-2 text-sm" />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-[#1A1A1A] py-2 text-sm">Voltar</button>
                    <button type="button" onClick={() => { if (!canAdvanceToDelivery) { setCheckoutError("Preencha nome e telefone para continuar."); return; } setCheckoutError(""); setStep(3); }} className="rounded-xl bg-[#B2FF00] py-2 text-sm font-black text-black">Proximo</button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-3 rounded-xl border border-[#1A1A1A] bg-black p-3">
                  <p className="text-xs text-zinc-400">Entrega e pagamento</p>
                  {!isDeliveryUnlocked ? (
                    <div className="mt-2 rounded-xl border border-[#3B2A00] bg-[#2A1E00] px-3 py-2 text-xs text-[#FFD98A]">
                      Entrega desbloqueia em {formatCurrency(deliveryMinimum)}. Faltam {formatCurrency(missingForDelivery)} no carrinho.
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-[#123A24] bg-[#0B2418] px-3 py-2 text-xs text-[#9BFFD1]">
                      Pedido elegivel para entrega.
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!isDeliveryUnlocked}
                      onClick={() => {
                        if (!isDeliveryUnlocked) {
                          setCheckoutError(`Entrega disponivel somente para pedidos a partir de ${formatCurrency(deliveryMinimum)}.`);
                          return;
                        }
                        setCheckoutError("");
                        setFulfillmentMethod("entrega");
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${fulfillmentMethod === "entrega" ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A]"} ${!isDeliveryUnlocked ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      Entrega (min {formatCurrency(deliveryMinimum)})
                    </button>
                    <button type="button" onClick={() => setFulfillmentMethod("retirada")} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${fulfillmentMethod === "retirada" ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A]"}`}>Retirada</button>
                  </div>
                  {fulfillmentMethod === "entrega" ? (
                    <div className="mt-3 rounded-xl border border-[#1A1A1A] bg-[#080808] p-3">
                      <p className="flex items-center gap-1 text-xs text-zinc-400"><MapPin size={14} /> Endereco de entrega</p>
                      <input placeholder="Nome da rua" value={profile.street || ""} onChange={(event) => setProfile((current) => ({ ...current, street: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <input placeholder="Numero (opcional)" value={profile.number || ""} onChange={(event) => setProfile((current) => ({ ...current, number: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <input placeholder="Ponto de referencia" value={profile.reference || ""} onChange={(event) => setProfile((current) => ({ ...current, reference: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-[#1A1A1A] bg-[#080808] p-3 text-sm text-zinc-400">
                      O pedido sera separado para retirada no mercado.
                      {!isPickupUnlocked ? (
                        <p className="mt-2 text-xs text-[#FFD98A]">Faltam {formatCurrency(missingForPickup)} para atingir o minimo de retirada ({formatCurrency(pickupMinimum)}).</p>
                      ) : (
                        <p className="mt-2 text-xs text-[#9BFFD1]">Retirada liberada para este pedido.</p>
                      )}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setPaymentMethod("pix")} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${paymentMethod === "pix" ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A]"}`}>Pix</button>
                    <button type="button" onClick={() => setPaymentMethod("cartao")} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${paymentMethod === "cartao" ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A]"}`}>Cartao</button>
                    <button type="button" onClick={() => setPaymentMethod("dinheiro")} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${paymentMethod === "dinheiro" ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A]"}`}>Dinheiro</button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-[#1A1A1A] py-2 text-sm">Voltar</button>
                    <button
                      type="button"
                      disabled={!canAdvanceToReview}
                      onClick={() => {
                        if (!canAdvanceToReview) {
                          if (fulfillmentMethod === "retirada") {
                            setCheckoutError(`Retirada disponivel somente para pedidos a partir de ${formatCurrency(pickupMinimum)}.`);
                            return;
                          }
                          setCheckoutError("Preencha a rua para entrega.");
                          return;
                        }
                        setCheckoutError("");
                        setStep(4);
                      }}
                      className="rounded-xl bg-[#B2FF00] py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Proximo
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-3">
                  <div className="rounded-xl border border-[#1A1A1A] bg-black p-3 text-sm">
                    <p className="font-semibold">Resumo do pedido</p>
                    <p className="mt-2 text-zinc-400">Cliente: {profile.fullName}</p>
                    <p className="text-zinc-400">Telefone: {profile.phone}</p>
                    <p className="text-zinc-400">Atendimento: {fulfillmentMethod}</p>
                    <p className="text-zinc-400">Pagamento: {paymentMethod}</p>
                    <p className="mt-2 font-black text-[#B2FF00]">Total: {formatCurrency(total)}</p>
                  </div>

                  {paymentMethod === "pix" ? (
                    <div className="mt-3 rounded-xl border border-[#1A1A1A] bg-black p-3">
                      <p className="text-xs text-zinc-400">Pagamento via Pix</p>
                      <p className="mt-1 text-sm font-semibold text-[#B2FF00] break-all">{settings.pixKey || "Defina no painel administrativo"}</p>
                      <button type="button" onClick={copyPixKey} disabled={!settings.pixKey} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] py-2 text-sm disabled:opacity-45"><Copy size={14} /> Copiar chave Pix</button>
                      {copyDone ? <p className="mt-2 text-center text-xs text-[#B2FF00]">Chave copiada.</p> : null}
                    </div>
                  ) : null}

                  {checkoutError ? <p className="mt-2 text-xs text-red-400">{checkoutError}</p> : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setStep(3)} className="rounded-xl border border-[#1A1A1A] py-2 text-sm">Voltar</button>
                    <button type="button" onClick={submitOrder} className="rounded-xl bg-[#B2FF00] py-2 text-sm font-black text-black">Finalizar</button>
                  </div>
                </motion.div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pixFlowOpen && lastPixOrder ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setPixFlowOpen(false)}>
            <motion.div initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 25, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="mx-auto mt-8 w-full max-w-md rounded-3xl border border-[#1A1A1A] bg-[#080808] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black">Fluxo do Pagamento Pix</h3>
                <button type="button" onClick={() => setPixFlowOpen(false)} className="rounded-full border border-[#1A1A1A] p-1.5"><X size={14} /></button>
              </div>

              <p className="mt-2 text-xs text-zinc-400">Pedido #{lastPixOrder.id.slice(0, 8)} • total {formatCurrency(lastPixOrder.total)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">1. Pague no Pix usando a chave abaixo.</p>
              <p className="mt-1 break-all text-sm font-semibold text-[#B2FF00]">{settings.pixKey || "Defina a chave Pix no painel admin"}</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={copyPixKey} disabled={!settings.pixKey} className="flex items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] py-2 text-sm disabled:opacity-45">
                  <Copy size={14} /> Copiar chave Pix
                </button>
                <button type="button" onClick={() => downloadPixReceipt(lastPixOrder)} className="flex items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] py-2 text-sm">
                  <Download size={14} /> Baixar comprovante
                </button>
              </div>

              <p className="mt-3 text-[11px] text-zinc-500">2. Envie o arquivo do comprovante para o painel administrativo confirmar seu pagamento.</p>
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] px-3 py-2 text-sm">
                <Upload size={14} />
                {pixProofFile ? `Arquivo: ${pixProofFile.name}` : "Selecionar comprovante"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(event) => setPixProofFile(event.target.files?.[0] || null)}
                />
              </label>

              <button
                type="button"
                onClick={() => void handleSendPixProof()}
                disabled={!pixProofFile || pixProofUploading}
                className="mt-2 w-full rounded-xl bg-[#B2FF00] py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-45"
              >
                {pixProofUploading ? "Enviando comprovante..." : "Enviar comprovante ao admin"}
              </button>

              <button
                type="button"
                onClick={() => openPixProofWhatsApp(lastPixOrder)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366] py-2 text-sm text-[#25D366]"
              >
                <MessageCircle size={14} /> Enviar comprovante via WhatsApp
              </button>

              {pixProofFeedback ? <p className="mt-2 text-center text-xs text-zinc-300">{pixProofFeedback}</p> : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {Boolean(settings.whatsappNumber.replace(/\D/g, "")) ? (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed bottom-24 right-4 z-40 flex items-center gap-2"
          >
            <span className="rounded-full border border-[#1A1A1A] bg-black/90 px-3 py-1 text-xs font-semibold text-[#25D366] md:hidden">WhatsApp</span>
            <button
              type="button"
              onClick={openCompanyWhatsApp}
              className="grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-black shadow-[0_0_30px_rgba(37,211,102,0.4)] hover:shadow-[0_0_40px_rgba(37,211,102,0.6)] hover:scale-110 transition-all"
              aria-label="Abrir WhatsApp"
            >
              <MessageCircle size={24} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {checkoutDone ? <div className="fixed bottom-4 left-1/2 z-40 w-[92%] max-w-md -translate-x-1/2 rounded-xl border border-[#1A1A1A] bg-[#080808] p-3 text-center text-sm">Pedido enviado com sucesso. Em breve voce recebera atualizacoes do status.</div> : null}

      <button type="button" onClick={() => { setCartOpen(true); setStep(1); setCheckoutError(""); }} className="fixed bottom-5 left-1/2 z-30 w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-[#00AAFF] py-3 text-sm font-black text-black shadow-[0_0_25px_rgba(0,170,255,0.35)]">
        Abrir checkout ({cartCount})
      </button>
    </div>
  );
}
