"use client";

import Image from "next/image";
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
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
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
  Tag,
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
type CategoryFilter = string;

type PaymentMethod = Order["paymentMethod"];
type FulfillmentMethod = Order["fulfillmentMethod"];
const DEFAULT_DELIVERY_MINIMUM = 150;
const DEFAULT_PICKUP_MINIMUM = 100;
const PRODUCTS_PER_PAGE = 8;

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
  return rawCategory || "Outros";
}

function isPromotionWindowActive(startDate: string, endDate: string) {
  if (!startDate || !endDate) return false;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const now = new Date();
  return now >= start && now <= end;
}

export default function StorefrontClient() {
  const WHATSAPP_BUTTON_SIZE = 56;
  const WHATSAPP_EDGE_MARGIN = 12;
  const WHATSAPP_BOTTOM_CLEARANCE = 110;

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({
    pixKey: "",
    whatsappNumber: "",
    categories: [],
    promotionProductIds: [],
    promotionStartDate: "",
    promotionEndDate: "",
    promotionPrices: {},
    deliveryMinimum: DEFAULT_DELIVERY_MINIMUM,
    pickupMinimum: DEFAULT_PICKUP_MINIMUM,
    cashbackSpendThreshold: 0,
    cashbackRewardValue: 0,
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todos");
  const [currentProductsPage, setCurrentProductsPage] = useState(1);
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
  const whatsappDragConstraintsRef = useRef<HTMLDivElement | null>(null);
  const whatsappPositionInitializedRef = useRef(false);
  const whatsappX = useMotionValue(0);
  const whatsappY = useMotionValue(0);
  const [meatCutSelections, setMeatCutSelections] = useState<Record<string, string>>({});
  const [meatSelectionModal, setMeatSelectionModal] = useState<{ productId: string; cut: string; quantityKg: number } | null>(null);
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
      const remoteProducts = await getProductsCatalog();
      if (remoteProducts.length > 0) {
        setProducts(remoteProducts);
        try {
          localStorage.setItem("solar_cached_products_v1", JSON.stringify(remoteProducts));
        } catch {
          // Ignore storage issues.
        }
      } else {
        try {
          const cachedProductsRaw = localStorage.getItem("solar_cached_products_v1");
          if (cachedProductsRaw) {
            const cachedProducts = JSON.parse(cachedProductsRaw) as Product[];
            if (Array.isArray(cachedProducts) && cachedProducts.length > 0) {
              setProducts(cachedProducts);
            }
          }
        } catch {
          // Ignore cache parsing issues.
        }
      }

      const remoteSettings = await getAdminSettingsRemote();
      if ((remoteSettings.categories || []).length > 0) {
        setSettings(remoteSettings);
        try {
          localStorage.setItem("solar_cached_settings_v1", JSON.stringify(remoteSettings));
        } catch {
          // Ignore storage issues.
        }
      } else {
        try {
          const cachedSettingsRaw = localStorage.getItem("solar_cached_settings_v1");
          if (cachedSettingsRaw) {
            const cachedSettings = JSON.parse(cachedSettingsRaw) as AdminSettings;
            if (cachedSettings && Array.isArray(cachedSettings.categories) && cachedSettings.categories.length > 0) {
              setSettings(cachedSettings);
            }
          }
        } catch {
          // Ignore cache parsing issues.
        }
      }

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

  const promotionWindowActive = useMemo(
    () => isPromotionWindowActive(settings.promotionStartDate, settings.promotionEndDate),
    [settings.promotionEndDate, settings.promotionStartDate],
  );

  const promotionProductSet = useMemo(
    () => new Set(promotionWindowActive ? settings.promotionProductIds || [] : []),
    [promotionWindowActive, settings.promotionProductIds],
  );

  const promotionPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!promotionWindowActive) return map;
    const rawPrices = settings.promotionPrices || {};
    Object.entries(rawPrices).forEach(([productId, value]) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        map.set(productId, numeric);
      }
    });
    return map;
  }, [promotionWindowActive, settings.promotionPrices]);

  function getEffectiveProductPrice(product: Product) {
    return promotionPriceMap.get(product.id) ?? product.price;
  }

  const total = useMemo(() => {
    return cart.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return sum;
      return sum + getEffectiveProductPrice(product) * item.quantity;
    }, 0);
  }, [cart, products, promotionPriceMap]);

  const deliveryMinimum = Number.isFinite(settings.deliveryMinimum) ? Number(settings.deliveryMinimum) : DEFAULT_DELIVERY_MINIMUM;
  const pickupMinimum = Number.isFinite(settings.pickupMinimum) ? Number(settings.pickupMinimum) : DEFAULT_PICKUP_MINIMUM;
  const isDeliveryUnlocked = total >= deliveryMinimum;
  const missingForDelivery = Math.max(0, deliveryMinimum - total);
  const isPickupUnlocked = total >= pickupMinimum;
  const missingForPickup = Math.max(0, pickupMinimum - total);

  function getWhatsAppDragBounds() {
    const minX = WHATSAPP_EDGE_MARGIN;
    const minY = WHATSAPP_EDGE_MARGIN;
    const maxX = Math.max(minX, window.innerWidth - WHATSAPP_BUTTON_SIZE - WHATSAPP_EDGE_MARGIN);
    const maxY = Math.max(minY, window.innerHeight - WHATSAPP_BUTTON_SIZE - Math.max(WHATSAPP_EDGE_MARGIN, WHATSAPP_BOTTOM_CLEARANCE));
    return { minX, minY, maxX, maxY };
  }

  function clampAndPersistWhatsAppPosition() {
    const bounds = getWhatsAppDragBounds();
    const clampedX = Math.min(Math.max(whatsappX.get(), bounds.minX), bounds.maxX);
    const clampedY = Math.min(Math.max(whatsappY.get(), bounds.minY), bounds.maxY);
    whatsappX.set(clampedX);
    whatsappY.set(clampedY);

    try {
      localStorage.setItem("solar_whatsapp_bubble_pos_v1", JSON.stringify({ x: clampedX, y: clampedY }));
    } catch {
      // Ignore storage errors on restricted browsers.
    }
  }

  useEffect(() => {
    const bounds = getWhatsAppDragBounds();

    if (!whatsappPositionInitializedRef.current) {
      let initialX = bounds.maxX;
      let initialY = bounds.maxY;

      try {
        const savedRaw = localStorage.getItem("solar_whatsapp_bubble_pos_v1");
        if (savedRaw) {
          const saved = JSON.parse(savedRaw) as { x?: number; y?: number };
          if (typeof saved.x === "number") initialX = saved.x;
          if (typeof saved.y === "number") initialY = saved.y;
        }
      } catch {
        // Ignore storage read errors.
      }

      whatsappX.set(Math.min(Math.max(initialX, bounds.minX), bounds.maxX));
      whatsappY.set(Math.min(Math.max(initialY, bounds.minY), bounds.maxY));
      whatsappPositionInitializedRef.current = true;
    }
  }, [whatsappX, whatsappY]);

  useEffect(() => {
    try {
      const savedScrollRaw = localStorage.getItem("solar_store_scroll_y_v1");
      if (!savedScrollRaw) return;
      const savedScroll = Number(savedScrollRaw);
      if (!Number.isFinite(savedScroll)) return;

      window.setTimeout(() => {
        window.scrollTo({ top: savedScroll, behavior: "auto" });
      }, 80);
    } catch {
      // Ignore storage issues.
    }
  }, []);

  function persistReturnStateBeforeWhatsApp() {
    clampAndPersistWhatsAppPosition();

    try {
      localStorage.setItem("solar_store_scroll_y_v1", String(window.scrollY || 0));
      localStorage.setItem("solar_store_last_path_v1", `${window.location.pathname}${window.location.search}`);
    } catch {
      // Ignore storage issues.
    }
  }

  useEffect(() => {
    if (!isDeliveryUnlocked && fulfillmentMethod === "entrega") {
      setFulfillmentMethod("retirada");
    }
  }, [fulfillmentMethod, isDeliveryUnlocked]);

  function normalizeCategory(raw: string): string {
    return raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  const dynamicDisplayCategories = useMemo(() => {
    const promoEntry = { key: "promocoes", label: "Promoções" };
    const catEntries = settings.categories.map((cat) => ({
      key: normalizeCategory(cat),
      label: cat,
    }));
    return [promoEntry, ...catEntries];
  }, [settings.categories]);

  const searchedProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm);
      if (!matchSearch) return false;
      if (categoryFilter === "todos") return true;
      if (categoryFilter === "promocoes") return promotionProductSet.has(product.id);
      return normalizeCategory(product.category) === categoryFilter;
    });
  }, [products, search, categoryFilter, promotionProductSet]);

  const visibleDisplayCategories = useMemo(
    () => dynamicDisplayCategories.filter((category) => category.key !== "promocoes" || promotionProductSet.size > 0),
    [dynamicDisplayCategories, promotionProductSet.size],
  );

  const shouldLimitCategoryGrid = categoryFilter === "todos" && !search.trim();

  const totalProductsPages = useMemo(() => {
    if (shouldLimitCategoryGrid) return 1;
    return Math.max(1, Math.ceil(searchedProducts.length / PRODUCTS_PER_PAGE));
  }, [searchedProducts.length, shouldLimitCategoryGrid]);

  const paginatedProducts = useMemo(() => {
    if (shouldLimitCategoryGrid) return searchedProducts;
    const start = (currentProductsPage - 1) * PRODUCTS_PER_PAGE;
    return searchedProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [currentProductsPage, searchedProducts, shouldLimitCategoryGrid]);

  useEffect(() => {
    setCurrentProductsPage(1);
  }, [search, categoryFilter]);

  useEffect(() => {
    setCurrentProductsPage((current) => Math.min(current, totalProductsPages));
  }, [totalProductsPages]);

  useEffect(() => {
    if (categoryFilter === "promocoes" && promotionProductSet.size === 0) {
      setCategoryFilter("todos");
    }
  }, [categoryFilter, promotionProductSet]);

  const sectionedProducts = useMemo(() => {
    if (categoryFilter === "promocoes") {
      return [{ name: "Promoções", items: paginatedProducts }].filter((section) => section.items.length > 0);
    }

    const groups = new Map<string, Product[]>();

    paginatedProducts.forEach((product) => {
      const section = getSectionName(product.category);
      const list = groups.get(section) || [];
      if (!shouldLimitCategoryGrid || list.length < 4) {
        list.push(product);
      }
      groups.set(section, list);
    });

    const order = [...settings.categories, "Outros"];
    return order.map((name) => ({ name, items: groups.get(name) || [] })).filter((section) => section.items.length > 0);
  }, [categoryFilter, paginatedProducts, settings.categories, shouldLimitCategoryGrid]);

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

  const MEAT_CUTS = ["Bife", "Inteiro", "Moído"] as const;

  function formatQuantityLabel(value: number, product?: Product) {
    if (product?.unit === "kg") {
      return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
    }
    return String(value);
  }

  function isMeat(product: Product) {
    return normalizeCategory(product.category) === "carnes";
  }

  function getMeatCut(productId: string) {
    return meatCutSelections[productId] ?? MEAT_CUTS[0];
  }

  function openMeatSelection(product: Product) {
    const existing = cart.find((item) => item.productId === product.id);
    setMeatSelectionModal({
      productId: product.id,
      cut: existing?.meatCut ?? getMeatCut(product.id),
      quantityKg: existing?.quantity ?? 1,
    });
  }

  function confirmMeatSelection() {
    if (!meatSelectionModal) return;
    const normalizedKg = Number(meatSelectionModal.quantityKg);
    if (!Number.isFinite(normalizedKg) || normalizedKg <= 0) return;

    const roundedKg = Math.round(normalizedKg * 100) / 100;
    setMeatCutSelections((prev) => ({ ...prev, [meatSelectionModal.productId]: meatSelectionModal.cut }));
    setCart((prev) => {
      const index = prev.findIndex((item) => item.productId === meatSelectionModal.productId);
      if (index === -1) {
        return [...prev, { productId: meatSelectionModal.productId, quantity: roundedKg, meatCut: meatSelectionModal.cut }];
      }
      const next = [...prev];
      next[index] = { ...next[index], quantity: roundedKg, meatCut: meatSelectionModal.cut };
      return next;
    });
    setMeatSelectionModal(null);
    setCheckoutError("");
  }

  function addToCart(productId: string, meatCut?: string) {
    setCart((prev) => {
      const index = prev.findIndex((item) => item.productId === productId);
      if (index === -1) return [...prev, { productId, quantity: 1, meatCut }];
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].quantity + 1, meatCut: meatCut ?? next[index].meatCut };
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
    persistReturnStateBeforeWhatsApp();
    const waPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const suffix = whatsAppDraftMessage ? `?text=${encodeURIComponent(whatsAppDraftMessage)}` : "";
    window.open(`https://wa.me/${waPhone}${suffix}`, "_blank", "noopener,noreferrer");
  }

  function openPixProofWhatsApp(order: Order) {
    const phone = settings.whatsappNumber.replace(/\D/g, "");
    if (!phone) return;
    persistReturnStateBeforeWhatsApp();
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
          name: item.meatCut ? `${product.name} (${item.meatCut})` : product.name,
          quantity: item.quantity,
          unitPrice: getEffectiveProductPrice(product),
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
    <div className="min-h-screen bg-black pb-28 text-white">
      <header className="sticky top-0 z-30 border-b border-[#1A1A1A] bg-black/85 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center gap-0">
          <button
            type="button"
            onClick={() => setCategorySidebarOpen(true)}
            className="flex h-14 w-24 shrink-0 items-center justify-center bg-transparent px-0 sm:h-16 sm:w-36"
            aria-label="Abrir categorias"
          >
            <Image
              src="/image-removebg-preview.png"
              alt="Solar Supermercado"
              width={173}
              height={55}
              priority
              className="h-11 w-auto max-w-full object-contain sm:h-14"
            />
          </button>

          <div className="relative ml-1.5 min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto" className="h-10 w-full rounded-xl border border-[#1A1A1A] bg-black py-2 pl-9 pr-3 text-sm sm:h-auto" />
          </div>

          <div className="ml-2 flex items-center gap-1.5 shrink-0 sm:ml-2 sm:gap-2">
            <button type="button" onClick={() => setAccountOpen(true)} className="rounded-full border border-[#1A1A1A] p-1.5 sm:p-2" aria-label="Perfil">
              <User size={17} />
            </button>
            {promotionProductSet.size > 0 ? (
              <button
                type="button"
                onClick={() => { setCategoryFilter("promocoes"); setCurrentProductsPage(1); setCategorySidebarOpen(false); }}
                className="relative rounded-full bg-[#B2FF00] p-1.5 text-black shadow-[0_0_14px_rgba(178,255,0,0.5)] sm:p-2"
                aria-label="Ver promoções"
              >
                <Tag size={17} />
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#FF4400] text-[9px] font-bold text-white">{promotionProductSet.size}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setCartOpen(true);
                setStep(1);
                setCheckoutError("");
              }}
              className="relative rounded-full bg-[#B2FF00] p-1.5 text-black sm:p-2"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart size={17} />
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
                {section.items.map((product) => {
                  const effectivePrice = getEffectiveProductPrice(product);
                  const hasPromotionPrice = promotionPriceMap.has(product.id);
                  return (
                    <motion.article
                      key={product.id}
                      variants={itemVariants}
                      whileHover={{ y: -5, scale: 1.01 }}
                      onClick={() => {
                        if (isMeat(product)) {
                          openMeatSelection(product);
                        }
                      }}
                      className={`group overflow-hidden rounded-2xl border border-[#1A1A1A] bg-[#080808] shadow-[0_6px_20px_rgba(0,0,0,0.35)] ${isMeat(product) ? "cursor-pointer" : ""}`}
                    >
                      <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-t-2xl bg-transparent">
                        <img src={product.image} alt={product.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                        {promotionProductSet.has(product.id) ? (
                          <div className="absolute left-2 top-2 rounded-full bg-[#B2FF00] px-2 py-0.5 text-[10px] font-black uppercase text-black shadow-[0_0_15px_rgba(178,255,0,0.55)]">
                            Promo
                          </div>
                        ) : null}
                        {quantityMap.get(product.id) ? <div className="absolute right-2 top-2 rounded-full bg-[#B2FF00] px-2 py-0.5 text-[10px] font-black text-black">{formatQuantityLabel(quantityMap.get(product.id) || 0, product)} no carrinho</div> : null}
                      </div>
                      <div className="p-2.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{product.category}</p>
                        <h2 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{product.name}</h2>
                        {isMeat(product) && (
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openMeatSelection(product);
                              }}
                              className="w-full rounded-lg border border-[#1A1A1A] bg-black/60 py-1.5 text-[10px] font-semibold text-zinc-300"
                            >
                              Escolher corte e kg
                            </button>
                            <p className="mt-1 text-[10px] text-[#B2FF00]">Corte atual: {getMeatCut(product.id)}</p>
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex flex-col">
                            {hasPromotionPrice ? <span className="text-[10px] text-zinc-500 line-through">{formatCurrency(product.price)}</span> : null}
                            <strong className="text-sm font-black text-[#B2FF00]">{formatCurrency(effectivePrice)}</strong>
                          </div>
                          {isMeat(product) ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openMeatSelection(product);
                              }}
                              className="rounded-full border border-[#1A1A1A] px-3 py-1 text-[10px] font-semibold text-zinc-300"
                            >
                              Selecionar
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => decrementFromCart(product.id)} className="grid h-7 w-7 place-items-center rounded-full border border-[#1A1A1A]" aria-label="Diminuir"><Minus size={13} /></button>
                              <button type="button" onClick={() => addToCart(product.id)} className="grid h-7 w-7 place-items-center rounded-full bg-[#00AAFF] text-black" aria-label="Adicionar"><Plus size={13} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            </section>
          ))}

        </div>

        {searchedProducts.length > 0 ? (
          <div className="mt-4 rounded-xl border border-[#1A1A1A] bg-[#080808] px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
              <span>Pagina {currentProductsPage} de {totalProductsPages}</span>
              <span>{searchedProducts.length} produto(s)</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCurrentProductsPage((current) => Math.max(1, current - 1))}
                disabled={currentProductsPage <= 1}
                className="rounded-xl border border-[#1A1A1A] py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => setCurrentProductsPage((current) => Math.min(totalProductsPages, current + 1))}
                disabled={currentProductsPage >= totalProductsPages}
                className="rounded-xl border border-[#1A1A1A] py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Próxima →
              </button>
            </div>
          </div>
        ) : null}

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
                {visibleDisplayCategories.map((category) => (
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
                            <span>{formatCurrency(getEffectiveProductPrice(product) * item.quantity)}</span>
                          </div>
                          {item.meatCut && (
                            <p className="mt-0.5 text-[10px] font-semibold text-[#B2FF00]">Corte: {item.meatCut}</p>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-zinc-400">Qtd: {formatQuantityLabel(item.quantity, product)}</span>
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
        {meatSelectionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setMeatSelectionModal(null)}>
            <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="mx-auto mt-20 w-full max-w-sm rounded-3xl border border-[#1A1A1A] bg-[#080808] p-4">
              <h3 className="text-base font-black">Escolha o corte da carne</h3>
              <p className="mt-1 text-xs text-zinc-400">Defina o corte e a quantidade em kg.</p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {MEAT_CUTS.map((cut) => (
                  <button
                    key={cut}
                    type="button"
                    onClick={() => setMeatSelectionModal((current) => (current ? { ...current, cut } : current))}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold ${meatSelectionModal.cut === cut ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A] text-zinc-300"}`}
                  >
                    {cut}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs text-zinc-400">Quantidade (kg)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={meatSelectionModal.quantityKg}
                  onChange={(event) => {
                    const numeric = Number(event.target.value);
                    setMeatSelectionModal((current) => (current ? { ...current, quantityKg: numeric } : current));
                  }}
                  className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMeatSelectionModal(null)} className="rounded-xl border border-[#1A1A1A] py-2 text-sm">Cancelar</button>
                <button type="button" onClick={confirmMeatSelection} className="rounded-xl bg-[#B2FF00] py-2 text-sm font-black text-black">Adicionar</button>
              </div>
            </motion.div>
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
            ref={whatsappDragConstraintsRef}
            className="pointer-events-none fixed inset-0 z-40"
          >
            <motion.button
              type="button"
              onClick={openCompanyWhatsApp}
              drag
              dragConstraints={whatsappDragConstraintsRef}
              dragMomentum={false}
              dragElastic={0.08}
              style={{ x: whatsappX, y: whatsappY }}
              onDragEnd={clampAndPersistWhatsAppPosition}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileTap={{ scale: 0.94 }}
              className="pointer-events-auto absolute grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-black shadow-[0_0_30px_rgba(37,211,102,0.4)] hover:shadow-[0_0_40px_rgba(37,211,102,0.6)] hover:scale-110 transition-all"
              aria-label="Abrir WhatsApp"
            >
              <MessageCircle size={24} />
            </motion.button>
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
