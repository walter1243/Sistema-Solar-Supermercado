"use client";

import { jsPDF } from "jspdf";
import {
  createAdminUserRemote,
  clearAdminSessionRemote,
  createProduct,
  deleteProductRemote,
  deleteAdminUserRemote,
  getAdminSessionRemote,
  getAdminSettingsRemote,
  getDashboardSummary,
  getDeliveryList,
  getCustomersForAdmin,
  getOrdersForAdmin,
  getProductsCatalog,
  listAdminUsersRemote,
  loginAdminRemote,
  saveAdminProfileRemote,
  saveAdminSettingsRemote,
  sendCustomerAlertRemote,
  updateProductRemote,
  updateOrderStatusRemote,
} from "@/lib/api";
import { AdminSettings, AdminUser, CustomerAccount, DashboardSummary, Order, Product } from "@/types/domain";
import {
  ChartNoAxesColumn,
  Download,
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
  UserPlus,
  Users,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Pencil,
  Trash2,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductUnit } from "@/types/domain";

type Tab = "dashboard" | "produtos" | "pedidos" | "entregas" | "clientes";

type ProductFormState = {
  name: string;
  price: string;
  image: string;
  category: string;
  unit: ProductUnit;
};

type UniqueCustomer = {
  fullName: string;
  phone: string;
  cpf: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  customerId?: string;
};

const tabs: Array<{ id: Tab; label: string; icon: ComponentType<{ size?: number }> }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "produtos", label: "Produtos", icon: PackageSearch },
  { id: "pedidos", label: "Pedidos", icon: ReceiptText },
  { id: "entregas", label: "Entregas", icon: Truck },
  { id: "clientes", label: "Clientes", icon: Users },
];

const initialProduct: ProductFormState = {
  name: "",
  price: "",
  image: "",
  category: "Mercearia",
  unit: "und",
};

const productUnits: ProductUnit[] = ["und", "cx", "kg", "pact", "fardo"];
const PRODUCTS_PER_PAGE = 6;

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

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
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
  const [customerAccounts, setCustomerAccounts] = useState<CustomerAccount[]>([]);
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({ revenueToday: 0, ordersToday: 0, productsToday: 0, totalProducts: 0 });
  const [settings, setSettings] = useState<AdminSettings>({
    pixKey: "",
    whatsappNumber: "",
    categories: ["Mercearia", "Carnes", "Bebidas", "Hortfruit", "Limpeza"],
    promotionProductIds: [],
    deliveryMinimum: 150,
    pickupMinimum: 100,
    cashbackSpendThreshold: 0,
    cashbackRewardValue: 0,
  });
  const [productForm, setProductForm] = useState<ProductFormState>(initialProduct);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("todas");
  const [currentProductsPage, setCurrentProductsPage] = useState(1);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", username: "", password: "", profileImage: "" });
  const [adminAccounts, setAdminAccounts] = useState<AdminUser[]>([]);
  const [adminForm, setAdminForm] = useState({ name: "", username: "", password: "123456" });
  const [isSavingAdminUser, setIsSavingAdminUser] = useState(false);
  const [isProcessingProductImage, setIsProcessingProductImage] = useState(false);
  const [isProductImageDropActive, setIsProductImageDropActive] = useState(false);
  const [adminNotice, setAdminNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [customerAlertForm, setCustomerAlertForm] = useState({ customerId: "", title: "", message: "" });

  useEffect(() => {
    const bootstrap = async () => {
      const adminSettings = await getAdminSettingsRemote();
      setSettings(adminSettings);
      setProductForm((current) => ({ ...current, category: adminSettings.categories[0] || "Mercearia" }));

      const session = await getAdminSessionRemote();
      if (session) {
        setAdminUser(session);
        setProfileForm({
          name: session.name,
          username: session.username,
          password: session.password || "123456",
          profileImage: session.profileImage || "",
        });
        setAdminAccounts(await listAdminUsersRemote());
        await refreshAll();
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (adminNotice) {
      const timer = setTimeout(() => {
        setAdminNotice(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [adminNotice]);

  async function refreshAll() {
    setProducts(await getProductsCatalog());
    setOrders(await getOrdersForAdmin());
    setCustomerAccounts(await getCustomersForAdmin());
    setDeliveries(await getDeliveryList());
    setSummary(await getDashboardSummary());
    setSettings(await getAdminSettingsRemote());
    setAdminAccounts(await listAdminUsersRemote());
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

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = productCategoryFilter === "todas" || product.category === productCategoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;
      const searchable = `${product.name} ${product.category} ${product.unit}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [productSearch, productCategoryFilter, products]);

  const promotionProductSet = useMemo(() => new Set(settings.promotionProductIds || []), [settings.promotionProductIds]);
  const promotionProducts = useMemo(
    () => products.filter((product) => promotionProductSet.has(product.id)),
    [products, promotionProductSet],
  );

  const totalProductsPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  }, [filteredProducts.length]);

  const paginatedProducts = useMemo(() => {
    const start = (currentProductsPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [currentProductsPage, filteredProducts]);

  useEffect(() => {
    setCurrentProductsPage(1);
  }, [productSearch, productCategoryFilter]);

  useEffect(() => {
    setCurrentProductsPage((current) => Math.min(current, totalProductsPages));
  }, [totalProductsPages]);

  const productsStart = filteredProducts.length === 0 ? 0 : (currentProductsPage - 1) * PRODUCTS_PER_PAGE + 1;
  const productsEnd = Math.min(currentProductsPage * PRODUCTS_PER_PAGE, filteredProducts.length);

  const isAnyProductActionLoading = isSavingProduct || Boolean(deletingProductId);

  const productSubmitLabel = isSavingProduct
    ? editingProductId
      ? "Atualizando..."
      : "Salvando..."
    : editingProductId
      ? "Atualizar Produto"
      : "Salvar Produto";

  const uniqueCustomers = useMemo(() => {
    const normalizePhone = (value: string) => value.replace(/\D/g, "");
    const customerMap = new Map<string, UniqueCustomer>();
    
    orders.forEach((order) => {
      const key = order.customer.phone;
      
      if (customerMap.has(key)) {
        const existing = customerMap.get(key)!;
        existing.totalOrders += 1;
        existing.totalSpent += order.total;
        if (new Date(order.createdAt) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = order.createdAt;
          existing.customerId = order.customerId || existing.customerId;
        }
      } else {
        customerMap.set(key, {
          fullName: order.customer.fullName,
          phone: order.customer.phone,
          cpf: order.customer.cpf,
          address: order.customer.address,
          totalOrders: 1,
          totalSpent: order.total,
          lastOrderDate: order.createdAt,
          customerId: order.customerId,
        });
      }
    });
    
    const fromOrders = Array.from(customerMap.values());

    const enriched = fromOrders.map((customer) => {
      if (customer.customerId) return customer;
      const matchedAccount = customerAccounts.find((account) => normalizePhone(account.phone) === normalizePhone(customer.phone));
      if (!matchedAccount) return customer;
      return {
        ...customer,
        customerId: matchedAccount.id,
      };
    });

    return enriched.sort((a, b) => 
      new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
    );
  }, [customerAccounts, orders]);

  function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    void (async () => {
      const user = await loginAdminRemote(authForm.username, authForm.password);
      if (!user) {
        setAuthError("Usuario ou senha invalidos.");
        return;
      }
      setAdminUser(user);
      setProfileForm({
        name: user.name,
        username: user.username,
        password: user.password || "123456",
        profileImage: user.profileImage || "",
      });
      setAuthError("");
      setAdminNotice({ type: "success", text: "Login realizado com sucesso. Bem-vindo ao painel." });
      setAuthForm((current) => ({ ...current, password: "" }));
      setAdminAccounts(await listAdminUsersRemote());
      await refreshAll();
    })();
  }

  function handleLogout() {
    void clearAdminSessionRemote();
    setAdminUser(null);
    setMenuOpen(false);
  }

  async function handleSaveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!productForm.name || !productForm.price || isSavingProduct) return;

    setIsSavingProduct(true);

    const product: Product = {
      id: editingProductId || crypto.randomUUID(),
      name: productForm.name,
      price: Number(productForm.price),
      image: productForm.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=640&q=80",
      category: productForm.category,
      unit: productForm.unit,
      createdAt: editingProductId
        ? products.find((item) => item.id === editingProductId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };

    try {
      if (editingProductId) {
        await updateProductRemote(product);
        setAdminNotice({ type: "success", text: "Produto atualizado com sucesso." });
      } else {
        await createProduct(product);
        setAdminNotice({ type: "success", text: "Produto cadastrado com sucesso e disponivel na loja." });
      }

      setEditingProductId(null);
      setProductForm({ ...initialProduct, category: settings.categories[0] || "Mercearia" });
      await refreshAll();
    } finally {
      setIsSavingProduct(false);
    }
  }

  function handleEditProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      price: String(product.price),
      image: product.image,
      category: product.category,
      unit: product.unit,
    });
    setAdminNotice({ type: "info", text: `Editando produto: ${product.name}.` });
  }

  function handleCancelProductEdit() {
    setEditingProductId(null);
    setProductForm({ ...initialProduct, category: settings.categories[0] || "Mercearia" });
  }

  async function handleDeleteProduct(product: Product) {
    if (deletingProductId) return;
    const confirmed = window.confirm(`Deseja excluir o produto \"${product.name}\"?`);
    if (!confirmed) return;

    setDeletingProductId(product.id);
    try {
      const deleted = await deleteProductRemote(product.id);
      if (!deleted) {
        setAdminNotice({ type: "error", text: "Nao foi possivel excluir o produto." });
        return;
      }

      if (editingProductId === product.id) {
        handleCancelProductEdit();
      }

      setAdminNotice({ type: "success", text: `Produto ${product.name} excluido com sucesso.` });

      if (promotionProductSet.has(product.id)) {
        const nextSettings = {
          ...settings,
          promotionProductIds: settings.promotionProductIds.filter((id) => id !== product.id),
        };
        setSettings(nextSettings);
        try {
          const saved = await saveAdminSettingsRemote(nextSettings);
          setSettings(saved);
        } catch {
          // Keep local state when remote settings update is unavailable.
        }
      }

      await refreshAll();
    } finally {
      setDeletingProductId(null);
    }
  }

  async function handleTogglePromotionProduct(productId: string) {
    const isInPromotion = promotionProductSet.has(productId);
    const nextSettings = {
      ...settings,
      promotionProductIds: isInPromotion
        ? settings.promotionProductIds.filter((id) => id !== productId)
        : [...settings.promotionProductIds, productId],
    };

    setSettings(nextSettings);

    try {
      const saved = await saveAdminSettingsRemote(nextSettings);
      setSettings(saved);
      setAdminNotice({
        type: "success",
        text: isInPromotion ? "Produto removido da promocao." : "Produto adicionado na promocao.",
      });
    } catch {
      setAdminNotice({ type: "error", text: "Nao foi possivel atualizar a lista de promocao." });
    }
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed || settings.categories.includes(trimmed)) return;
    const next = { ...settings, categories: [...settings.categories, trimmed] };
    setSettings(next);
    setNewCategory("");
    setAdminNotice({ type: "info", text: `Categoria ${trimmed} adicionada.` });
  }

  async function handleDeleteCategory(categoryToDelete: string) {
    if (settings.categories.length <= 1) {
      setAdminNotice({ type: "error", text: "Mantenha pelo menos uma categoria cadastrada." });
      return;
    }

    const confirmed = window.confirm(`Tem certeza que deseja excluir a categoria \"${categoryToDelete}\"?`);
    if (!confirmed) return;

    const filteredCategories = settings.categories.filter((category) => category !== categoryToDelete);
    const nextSettings = {
      ...settings,
      categories: filteredCategories,
    };

    setSettings(nextSettings);
    setProductForm((current) => ({
      ...current,
      category: current.category === categoryToDelete ? filteredCategories[0] || "Mercearia" : current.category,
    }));

    try {
      const saved = await saveAdminSettingsRemote(nextSettings);
      setSettings(saved);
    } catch {
      // Keep local state when remote settings update is unavailable.
    }

    setAdminNotice({ type: "success", text: `Categoria ${categoryToDelete} excluida com sucesso.` });
  }

  async function handleSaveProfile() {
    const nextProfile: AdminUser = {
      name: profileForm.name,
      username: profileForm.username,
      password: profileForm.password,
      profileImage: profileForm.profileImage,
    };

    const normalizedSettings: AdminSettings = {
      ...settings,
      deliveryMinimum: Math.max(0, Number(settings.deliveryMinimum) || 0),
      pickupMinimum: Math.max(0, Number(settings.pickupMinimum) || 0),
      cashbackSpendThreshold: Math.max(0, Number(settings.cashbackSpendThreshold) || 0),
      cashbackRewardValue: Math.max(0, Number(settings.cashbackRewardValue) || 0),
    };

    const savedProfile = await saveAdminProfileRemote(nextProfile);
    setAdminUser(savedProfile);
    setProfileForm({
      name: savedProfile.name,
      username: savedProfile.username,
      password: savedProfile.password || "123456",
      profileImage: savedProfile.profileImage || "",
    });

    const nextSettings = await saveAdminSettingsRemote(normalizedSettings);
    setSettings(nextSettings);
    setAdminAccounts(await listAdminUsersRemote());

    setAdminNotice({ type: "success", text: "Perfil e configuracoes do painel atualizados." });
    setProfileOpen(false);
  }

  async function handleCreateAdminUser(event: React.FormEvent) {
    event.preventDefault();
    if (isSavingAdminUser) return;

    setIsSavingAdminUser(true);

    try {
      const normalizedUsername = adminForm.username.trim().toLowerCase();

      const result = await createAdminUserRemote({
        name: adminForm.name,
        username: normalizedUsername,
        password: adminForm.password,
      });

      if (!result.user) {
        setAdminNotice({ type: "error", text: result.error || "Falha ao criar administrador." });
        return;
      }

      setAdminForm({ name: "", username: "", password: "123456" });
      setAdminAccounts(await listAdminUsersRemote());
      setAdminNotice({ type: "success", text: `Administrador @${result.user.username} criado com sucesso. Ja pode entrar no login com usuario e senha salvos.` });
    } finally {
      setIsSavingAdminUser(false);
    }
  }

  async function handleDeleteAdminUser(username: string) {
    if (username === adminUser?.username) {
      setAdminNotice({ type: "error", text: "Voce nao pode remover o administrador atualmente logado." });
      return;
    }

    const confirmed = window.confirm(`Deseja remover o administrador @${username}?`);
    if (!confirmed) return;

    const result = await deleteAdminUserRemote(username);
    if (!result.success) {
      setAdminNotice({ type: "error", text: result.error || "Falha ao remover administrador." });
      return;
    }

    setAdminAccounts(await listAdminUsersRemote());
    setAdminNotice({ type: "success", text: `Administrador @${username} removido.` });
  }

  async function handleStatusChange(orderId: string, status: Order["status"]) {
    const selected = orders.find((order) => order.id === orderId);
    await updateOrderStatusRemote(orderId, status, selected?.paymentConfirmed ?? false);
    setAdminNotice({ type: "success", text: `Status do pedido #${orderId.slice(0, 8)} atualizado para ${status}.` });
    void refreshAll();
  }

  async function handlePaymentConfirmation(orderId: string, confirmed: boolean) {
    const selected = orders.find((order) => order.id === orderId);
    await updateOrderStatusRemote(orderId, selected?.status || "novo", confirmed);
    setAdminNotice({ type: "success", text: confirmed ? `Pagamento do pedido #${orderId.slice(0, 8)} confirmado.` : `Pagamento do pedido #${orderId.slice(0, 8)} marcado como pendente.` });
    void refreshAll();
  }

  function sendOrderToWhatsApp(order: Order) {
    const whatsapp = settings.whatsappNumber.replace(/\D/g, "");
    if (!whatsapp) {
      setAdminNotice({ type: "error", text: "Defina o numero de WhatsApp da empresa nas configuracoes." });
      return;
    }
    setAdminNotice({ type: "info", text: `Abrindo WhatsApp para enviar o pedido #${order.id.slice(0, 8)}.` });
    window.open(`https://wa.me/55${whatsapp}?text=${buildWhatsAppMessage(order)}`, "_blank", "noopener,noreferrer");
  }

  async function handleImageFile(file: File, target: "product" | "profile") {
    if (target === "profile") {
      const result = await readFileAsDataUrl(file);
      setProfileForm((current) => ({ ...current, profileImage: result }));
      return;
    }

    setIsProcessingProductImage(true);
    setAdminNotice({ type: "info", text: "Processando imagem e removendo fundo..." });

    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const outputBlob = await removeBackground(file);
      const result = await readFileAsDataUrl(outputBlob);
      setProductForm((current) => ({ ...current, image: result }));
      setAdminNotice({ type: "success", text: "Imagem processada com fundo transparente." });
    } catch {
      const fallback = await readFileAsDataUrl(file);
      setProductForm((current) => ({ ...current, image: fallback }));
      setAdminNotice({ type: "error", text: "Nao foi possivel remover o fundo automaticamente. A imagem original foi carregada." });
    } finally {
      setIsProcessingProductImage(false);
    }
  }

  async function handleProductImagePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    if (isAnyProductActionLoading || isProcessingProductImage) return;
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const pastedFile = imageItem.getAsFile();
    if (!pastedFile) return;
    await handleImageFile(pastedFile, "product");
  }

  async function handleProductImageDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsProductImageDropActive(false);
    if (isAnyProductActionLoading || isProcessingProductImage) return;
    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile || !droppedFile.type.startsWith("image/")) return;
    await handleImageFile(droppedFile, "product");
  }

  function exportCustomersToPDF() {
    if (uniqueCustomers.length === 0) {
      setAdminNotice({ type: "error", text: "Nenhum cliente cadastrado para exportar." });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Título
    doc.setFontSize(16);
    doc.text("Cadastro de Clientes", pageWidth / 2, 15, { align: "center" });
    
    // Data de exportação
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth / 2, 25, { align: "center" });
    
    // Colunas da tabela
    const columns = [
      { header: "Nome", width: 40 },
      { header: "Telefone", width: 30 },
      { header: "CPF", width: 30 },
      { header: "Endereço", width: 40 },
      { header: "Pedidos", width: 15 },
      { header: "Total Gasto", width: 30 },
    ];
    
    // Posição inicial
    let yPosition = 35;
    const rowHeight = 8;
    const margin = 10;
    
    // Cabeçalho da tabela
    doc.setFontSize(11);
    doc.setFont("", "bold");
    doc.setFillColor(50, 50, 50);
    doc.setTextColor(255, 255, 255);
    
    let xPosition = margin;
    columns.forEach((col) => {
      doc.text(col.header, xPosition, yPosition, { maxWidth: col.width });
      xPosition += col.width;
    });
    
    yPosition += rowHeight;
    
    // Dados das linhas
    doc.setFont("", "normal");
    doc.setTextColor(0, 0, 0);
    
    uniqueCustomers.forEach((customer) => {
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin + rowHeight;
      }
      
      xPosition = margin;
      
      // Nome
      doc.text(customer.fullName.substring(0, 30), xPosition, yPosition, { maxWidth: columns[0].width });
      xPosition += columns[0].width;
      
      // Telefone
      doc.text(customer.phone, xPosition, yPosition, { maxWidth: columns[1].width });
      xPosition += columns[1].width;
      
      // CPF
      doc.text(customer.cpf, xPosition, yPosition, { maxWidth: columns[2].width });
      xPosition += columns[2].width;
      
      // Endereço
      doc.text(customer.address.substring(0, 30), xPosition, yPosition, { maxWidth: columns[3].width });
      xPosition += columns[3].width;
      
      // Número de pedidos
      doc.text(customer.totalOrders.toString(), xPosition, yPosition, { maxWidth: columns[4].width, align: "center" });
      xPosition += columns[4].width;
      
      // Total gasto
      doc.text(formatCurrency(customer.totalSpent), xPosition, yPosition, { maxWidth: columns[5].width, align: "right" });
      
      yPosition += rowHeight;
    });
    
    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    }
    
    // Download
    doc.save(`clientes-solarmercado-${new Date().toISOString().split("T")[0]}.pdf`);
    setAdminNotice({ type: "success", text: `PDF gerado com ${uniqueCustomers.length} cliente(s).` });
  }

  async function handleSendCustomerAlert(event: React.FormEvent) {
    event.preventDefault();

    if (!customerAlertForm.customerId) {
      setAdminNotice({ type: "error", text: "Selecione um cliente com conta cadastrada." });
      return;
    }

    if (!customerAlertForm.title.trim() || !customerAlertForm.message.trim()) {
      setAdminNotice({ type: "error", text: "Preencha titulo e mensagem do alerta." });
      return;
    }

    const sent = await sendCustomerAlertRemote(
      customerAlertForm.customerId,
      customerAlertForm.title,
      customerAlertForm.message,
    );

    if (!sent) {
      setAdminNotice({ type: "error", text: "Nao foi possivel enviar o alerta no servidor da Vercel." });
      return;
    }

    setAdminNotice({ type: "success", text: "Alerta enviado para o cliente com sucesso." });
    setCustomerAlertForm({ customerId: "", title: "", message: "" });
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
      <div className="relative min-h-screen overflow-hidden bg-black text-white">
        <img src="/fachada%20solar.jpg" alt="Fachada Solar Supermercado" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-[#080808]/78 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
            <div className="mb-5 text-center">
              <img
                src="/image-removebg-preview.png"
                alt="Solar Supermercado"
                className="mx-auto h-20 w-auto max-w-[360px] object-contain sm:h-24 sm:max-w-[420px] md:h-28 md:max-w-[480px]"
              />
              <h1 className="mt-3 text-xl font-black tracking-tight">Painel Admin</h1>
              <p className="mt-1 text-xs text-zinc-300">Acesse para gerenciar pedidos e entregas.</p>
            </div>

            <form onSubmit={handleLogin} className="grid gap-3">
              <input
                value={authForm.username}
                onChange={(event) => setAuthForm((state) => ({ ...state, username: event.target.value }))}
                placeholder="Usuario"
                className="rounded-xl border border-white/20 bg-black/55 px-3 py-2 text-sm"
              />
              <div className="relative">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={authForm.password}
                  onChange={(event) => setAuthForm((state) => ({ ...state, password: event.target.value }))}
                  placeholder="Senha"
                  className="w-full rounded-xl border border-white/20 bg-black/55 px-3 py-2 pr-10 text-sm"
                />
                <button type="button" onClick={() => setShowLoginPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300">
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {authError ? <p className="text-xs text-red-300">{authError}</p> : null}
              <button type="submit" className="rounded-xl bg-[#F6AE2D] py-2.5 text-sm font-black text-black">Entrar</button>
            </form>
          </div>
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
                <form onSubmit={handleSaveProduct} className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">{editingProductId ? "Editar Produto" : "Cadastro de Produto"}</h2>
                    {editingProductId ? (
                      <button
                        type="button"
                        onClick={handleCancelProductEdit}
                        disabled={isAnyProductActionLoading}
                        className="rounded-lg border border-[#1A1A1A] px-2 py-1 text-xs text-zinc-300"
                      >
                        Cancelar edicao
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">Selecione imagem do produto, categoria e publique no carrinho.</p>
                  <div className="mt-3 grid gap-2">
                    <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do produto" disabled={isAnyProductActionLoading} className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" />
                    <div className="grid grid-cols-[1fr_130px] gap-2">
                      <input value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} placeholder="Preco" type="number" step="0.01" disabled={isAnyProductActionLoading} className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" />
                      <select value={productForm.unit} onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value as ProductUnit }))} disabled={isAnyProductActionLoading} className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" aria-label="Unidade de medida">
                        {productUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </div>
                    <input ref={productImageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImageFile(file, "product"); }} />
                    <button type="button" onClick={() => productImageInputRef.current?.click()} disabled={isAnyProductActionLoading || isProcessingProductImage} className="flex items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"><ImagePlus size={16} /> {isProcessingProductImage ? "Removendo fundo..." : "Selecionar imagem"}</button>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => productImageInputRef.current?.click()}
                      onPaste={(event) => void handleProductImagePaste(event)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!isAnyProductActionLoading && !isProcessingProductImage) {
                          setIsProductImageDropActive(true);
                        }
                      }}
                      onDragLeave={() => setIsProductImageDropActive(false)}
                      onDrop={(event) => void handleProductImageDrop(event)}
                      className={`rounded-xl border border-dashed px-3 py-3 text-center text-xs transition-colors ${
                        isProductImageDropActive ? "border-[#B2FF00] bg-[#B2FF00]/10 text-[#B2FF00]" : "border-[#1A1A1A] bg-black text-zinc-400"
                      }`}
                    >
                      Cole com Ctrl+V ou arraste a imagem aqui.
                    </div>
                    {productForm.image ? <img src={productForm.image} alt="Preview" className="h-28 w-full rounded-xl bg-transparent object-contain" /> : null}
                    <select value={productForm.category} onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))} disabled={isAnyProductActionLoading} className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                      {settings.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <button type="submit" disabled={isAnyProductActionLoading} className="rounded-xl bg-[#B2FF00] py-2 font-black text-black disabled:cursor-not-allowed disabled:opacity-70">{productSubmitLabel}</button>
                  </div>
                </form>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                    <h2 className="text-lg font-bold">Categorias</h2>
                    <div className="mt-3 flex gap-2">
                      <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Nova categoria" className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                      <button type="button" onClick={handleAddCategory} className="rounded-xl bg-[#00AAFF] px-4 py-2 text-sm font-black text-black">Adicionar</button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {settings.categories.map((category) => (
                        <div key={category} className="inline-flex items-center gap-2 rounded-full border border-[#1A1A1A] px-3 py-1 text-xs text-zinc-300">
                          <span>{category}</span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCategory(category)}
                            className="grid h-4 w-4 place-items-center rounded-full border border-zinc-600 text-[10px] text-zinc-300 hover:border-red-400 hover:text-red-300"
                            aria-label={`Excluir categoria ${category}`}
                            title={`Excluir categoria ${category}`}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                    <h2 className="text-lg font-bold">Promocao</h2>
                    <p className="mt-1 text-xs text-zinc-400">Selecione os produtos que devem aparecer na categoria Promocao da loja.</p>
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                      {products.length === 0 ? (
                        <p className="rounded-xl border border-[#1A1A1A] bg-black/60 px-3 py-3 text-xs text-zinc-400">Cadastre produtos para montar a promocao.</p>
                      ) : (
                        products.map((product) => {
                          const selected = promotionProductSet.has(product.id);
                          return (
                            <label key={product.id} className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-sm ${selected ? "border-[#B2FF00] bg-[#B2FF00]/10" : "border-[#1A1A1A] bg-black/50"}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => void handleTogglePromotionProduct(product.id)}
                                className="h-4 w-4 accent-[#B2FF00]"
                              />
                              <img src={product.image} alt={product.name} className="h-9 w-9 rounded-lg object-cover" />
                              <span className="line-clamp-1 flex-1">{product.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">Produtos em promocao: {promotionProducts.length}</p>
                  </div>

                  <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                    <h2 className="text-lg font-bold">Produtos cadastrados</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_170px]">
                      <input
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Pesquisar por nome, categoria ou unidade"
                        className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                      />
                      <select
                        value={productCategoryFilter}
                        onChange={(event) => setProductCategoryFilter(event.target.value)}
                        className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                        aria-label="Filtrar produtos por categoria"
                      >
                        <option value="todas">Todas categorias</option>
                        {settings.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </div>

                    <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {paginatedProducts.length === 0 ? (
                        <p className="rounded-xl border border-[#1A1A1A] bg-black/60 px-3 py-3 text-xs text-zinc-400">Nenhum produto encontrado.</p>
                      ) : (
                        paginatedProducts.map((product) => (
                          <article key={product.id} className="rounded-xl border border-[#1A1A1A] bg-black/60 p-2">
                            <div className="flex items-center gap-2">
                              <img src={product.image} alt={product.name} className="h-12 w-12 rounded-lg object-cover" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{product.name}</p>
                                <p className="text-xs text-zinc-400">{product.category} • {product.unit} • {formatCurrency(product.price)}</p>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditProduct(product)}
                                disabled={isAnyProductActionLoading}
                                className="flex items-center justify-center gap-1 rounded-lg border border-[#00AAFF] px-2 py-1 text-xs text-[#00AAFF] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Pencil size={12} /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteProduct(product)}
                                disabled={isAnyProductActionLoading}
                                className="flex items-center justify-center gap-1 rounded-lg border border-red-500/60 px-2 py-1 text-xs text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 size={12} /> {deletingProductId === product.id ? "Excluindo..." : "Excluir"}
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-400">
                      <p>
                        Mostrando {productsStart}-{productsEnd} de {filteredProducts.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentProductsPage((current) => Math.max(1, current - 1))}
                          disabled={currentProductsPage <= 1}
                          className="rounded-lg border border-[#1A1A1A] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span>
                          Pagina {currentProductsPage} de {totalProductsPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentProductsPage((current) => Math.min(totalProductsPages, current + 1))}
                          disabled={currentProductsPage >= totalProductsPages}
                          className="rounded-lg border border-[#1A1A1A] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Proxima
                        </button>
                      </div>
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
                    {orders.length === 0 ? <p className="text-sm text-zinc-500">Nenhum pedido ainda.</p> : orders.map((order, index) => (
                      <button key={order.id} type="button" onClick={() => setSelectedOrderId(order.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${selectedOrderId === order.id ? "border-[#B2FF00] bg-[#B2FF00]/5" : "border-[#1A1A1A]"}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">Pedido {index + 1}</p>
                          <span className="rounded-full border border-[#1A1A1A] px-2 py-0.5 text-[11px] uppercase text-zinc-400">{order.status}</span>
                        </div>
                        <p className="mt-1 text-zinc-400">Cliente: {order.customer.fullName}</p>
                        <p className="text-zinc-400">Hora: {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                        <p className="text-zinc-400">Pagamento: {order.paymentMethod}</p>
                        {order.paymentMethod === "pix" ? (
                          <p className={`text-xs ${order.pixProofDataUrl ? "text-[#9BFFD1]" : "text-[#FFD98A]"}`}>
                            {order.pixProofDataUrl ? "Comprovante Pix recebido" : "Aguardando comprovante Pix"}
                          </p>
                        ) : null}
                        <p className="text-zinc-400">Atendimento: {order.fulfillmentMethod}</p>
                        <p className="mt-1 text-[#B2FF00]">{formatCurrency(order.total)}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                  <h2 className="text-lg font-bold">Fluxo do pedido</h2>
                  {selectedOrder ? (
                    <>
                      <div className="mt-3 rounded-xl border border-[#1A1A1A] p-3 text-sm">
                        <p className="font-semibold">{selectedOrder.customer.fullName}</p>
                        <p className="text-zinc-400">{selectedOrder.customer.address || "Retirada no local"}</p>
                        <p className="mt-2 text-zinc-400">Pagamento: {selectedOrder.paymentMethod}</p>
                        <p className="text-zinc-400">Atendimento: {selectedOrder.fulfillmentMethod}</p>
                      </div>
                      {selectedOrder.paymentMethod === "pix" ? (
                        <div className="mt-3 rounded-xl border border-[#1A1A1A] p-3 text-sm">
                          <p className="font-semibold">Comprovante Pix</p>
                          <p className={`mt-1 text-xs ${selectedOrder.pixProofDataUrl ? "text-[#9BFFD1]" : "text-[#FFD98A]"}`}>
                            {selectedOrder.pixProofDataUrl ? "Cliente enviou comprovante." : "Cliente ainda nao enviou comprovante."}
                          </p>
                          {selectedOrder.pixProofUploadedAt ? (
                            <p className="mt-1 text-[11px] text-zinc-500">Enviado em {new Date(selectedOrder.pixProofUploadedAt).toLocaleString("pt-BR")}</p>
                          ) : null}

                          {selectedOrder.pixProofDataUrl ? (
                            <>
                              {selectedOrder.pixProofDataUrl.startsWith("data:image/") ? (
                                <img src={selectedOrder.pixProofDataUrl} alt="Comprovante Pix" className="mt-2 max-h-48 w-full rounded-xl object-contain" />
                              ) : null}
                              <a
                                href={selectedOrder.pixProofDataUrl}
                                download={selectedOrder.pixProofFileName || `comprovante-${selectedOrder.id.slice(0, 8)}`}
                                className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-[#1A1A1A] px-3 py-2 text-xs"
                              >
                                Baixar comprovante enviado
                              </a>
                            </>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handlePaymentConfirmation(selectedOrder.id, !selectedOrder.paymentConfirmed)}
                            className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm ${selectedOrder.paymentConfirmed ? "border-[#B2FF00] text-[#B2FF00]" : "border-[#1A1A1A] text-zinc-300"}`}
                          >
                            {selectedOrder.paymentConfirmed ? "Pagamento OK" : "Confirmar pagamento Pix"}
                          </button>
                        </div>
                      ) : null}
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

            {activeTab === "clientes" && (
              <section className="overflow-hidden rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Cadastro de Clientes</h2>
                    <p className="mt-1 text-xs text-zinc-400">Total de {uniqueCustomers.length} cliente(s) com pedidos</p>
                  </div>
                  <button type="button" onClick={exportCustomersToPDF} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00AAFF] px-4 py-2 text-sm font-black text-black sm:w-auto">
                    <Download size={16} /> Exportar PDF
                  </button>
                </div>

                <form onSubmit={handleSendCustomerAlert} className="mb-4 rounded-2xl border border-[#1A1A1A] bg-black/40 p-3">
                  <p className="text-sm font-semibold">Enviar alerta para cliente</p>
                  <p className="mt-1 text-xs text-zinc-500">Somente clientes com conta cadastrada recebem alerta no app.</p>
                  <div className="mt-3 grid gap-2">
                    <select
                      value={customerAlertForm.customerId}
                      onChange={(event) => setCustomerAlertForm((current) => ({ ...current, customerId: event.target.value }))}
                      className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                    >
                      <option value="">Selecione o cliente</option>
                      {uniqueCustomers.map((customer) => (
                        <option key={`${customer.phone}-${customer.customerId || "guest"}`} value={customer.customerId || ""} disabled={!customer.customerId}>
                          {customer.fullName} - {customer.phone} {!customer.customerId ? "(sem conta)" : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      value={customerAlertForm.title}
                      onChange={(event) => setCustomerAlertForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Titulo do alerta"
                      className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                    />
                    <textarea
                      value={customerAlertForm.message}
                      onChange={(event) => setCustomerAlertForm((current) => ({ ...current, message: event.target.value }))}
                      placeholder="Mensagem para o cliente"
                      rows={3}
                      className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                    />
                    <button type="submit" className="w-full rounded-xl bg-[#B2FF00] py-2 text-sm font-black text-black">Enviar alerta</button>
                  </div>
                </form>

                {uniqueCustomers.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhum cliente cadastrado ainda.</p>
                ) : (
                  <>
                    <div className="grid gap-2 md:hidden">
                      {uniqueCustomers.map((customer, index) => (
                        <article key={`${customer.phone}-${index}`} className="rounded-xl border border-[#1A1A1A] bg-black/30 p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-white">{customer.fullName}</p>
                            <span className="rounded-full border border-[#1A1A1A] px-2 py-0.5 text-[11px] text-[#B2FF00]">{customer.totalOrders} pedido(s)</span>
                          </div>
                          <p className="mt-1 text-zinc-400">{customer.phone}</p>
                          <p className="text-zinc-400">CPF: {customer.cpf || "-"}</p>
                          <p className="mt-1 text-zinc-400">{customer.address}</p>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-zinc-500">Ultimo: {new Date(customer.lastOrderDate).toLocaleDateString("pt-BR")}</span>
                            <span className="font-semibold text-[#B2FF00]">{formatCurrency(customer.totalSpent)}</span>
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1A1A1A]">
                          <th className="px-3 py-2 text-left font-semibold text-zinc-300">Nome</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-300">Telefone</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-300">CPF</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-300">Endereço</th>
                          <th className="px-3 py-2 text-center font-semibold text-zinc-300">Pedidos</th>
                          <th className="px-3 py-2 text-right font-semibold text-zinc-300">Total Gasto</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-300">Último Pedido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uniqueCustomers.map((customer, index) => (
                          <tr key={`${customer.phone}-${index}`} className="border-b border-[#1A1A1A] hover:bg-black/30">
                            <td className="px-3 py-3 text-white">{customer.fullName}</td>
                            <td className="px-3 py-3 text-zinc-400">{customer.phone}</td>
                            <td className="px-3 py-3 text-zinc-400">{customer.cpf}</td>
                            <td className="px-3 py-3 text-zinc-400">{customer.address.substring(0, 40)}</td>
                            <td className="px-3 py-3 text-center text-[#B2FF00] font-semibold">{customer.totalOrders}</td>
                            <td className="px-3 py-3 text-right text-[#B2FF00] font-semibold">{formatCurrency(customer.totalSpent)}</td>
                            <td className="px-3 py-3 text-zinc-400 text-xs">{new Date(customer.lastOrderDate).toLocaleDateString("pt-BR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                )}
              </section>
            )}
          </main>
        </section>
      </div>

      <AnimatePresence>
        {adminNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed top-4 right-4 z-50 max-w-md"
          >
            <div
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
                adminNotice.type === "success"
                  ? "border-[#22C55E] bg-[#062E0B] text-[#86EFAC]"
                  : adminNotice.type === "error"
                    ? "border-[#EF4444] bg-[#1F0F0F] text-[#FECACA]"
                    : "border-[#3B82F6] bg-[#0F1C3F] text-[#93C5FD]"
              }`}
            >
              {adminNotice.type === "success" && <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />}
              {adminNotice.type === "error" && <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />}
              {adminNotice.type === "info" && <Info size={18} className="mt-0.5 flex-shrink-0" />}
              <p className="flex-1">{adminNotice.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {profileOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4" onClick={() => setProfileOpen(false)}>
          <div className="mx-auto mt-8 max-h-[calc(100vh-4rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#1A1A1A] bg-[#080808] p-4" onClick={(event) => event.stopPropagation()}>
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
                  <input ref={profileImageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImageFile(file, "profile"); }} />
                  <button type="button" onClick={() => profileImageInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1A1A1A] py-2 text-sm"><ImagePlus size={15} /> Upload de imagem</button>
                </div>
              </div>
              <input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do administrador" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
              <input value={profileForm.username} onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))} placeholder="Usuario" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
              <div className="relative">
                <input type={showProfilePassword ? "text" : "password"} value={profileForm.password} onChange={(event) => setProfileForm((current) => ({ ...current, password: event.target.value }))} placeholder="Nova senha" className="w-full rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 pr-10 text-sm" />
                <button type="button" onClick={() => setShowProfilePassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">{showProfilePassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>

              <div className="mt-2 rounded-xl border border-[#1A1A1A] bg-black/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Configuracoes de pedido</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={settings.deliveryMinimum}
                    onChange={(event) => setSettings((current) => ({ ...current, deliveryMinimum: Number(event.target.value || 0) }))}
                    placeholder="Minimo entrega"
                    className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={settings.pickupMinimum}
                    onChange={(event) => setSettings((current) => ({ ...current, pickupMinimum: Number(event.target.value || 0) }))}
                    placeholder="Minimo retirada"
                    className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                  />
                </div>
                <p className="mt-2 text-[11px] text-zinc-500">Valores em reais (R$).</p>
              </div>

              <div className="rounded-xl border border-[#1A1A1A] bg-black/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Politica de cashback</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={settings.cashbackSpendThreshold}
                    onChange={(event) => setSettings((current) => ({ ...current, cashbackSpendThreshold: Number(event.target.value || 0) }))}
                    placeholder="A cada X reais"
                    className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={settings.cashbackRewardValue}
                    onChange={(event) => setSettings((current) => ({ ...current, cashbackRewardValue: Number(event.target.value || 0) }))}
                    placeholder="Ganhar X cashback"
                    className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                  />
                </div>
                <p className="mt-2 text-[11px] text-zinc-500">Exemplo: a cada R$ 100,00 gastos, libera R$ 10,00 de cashback.</p>
              </div>

              <div className="rounded-xl border border-[#1A1A1A] bg-black/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Contato e pagamento</p>
                <div className="mt-2 grid gap-2">
                  <input value={settings.pixKey} onChange={(event) => setSettings((current) => ({ ...current, pixKey: event.target.value }))} placeholder="Chave Pix" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                  <input value={settings.whatsappNumber} onChange={(event) => setSettings((current) => ({ ...current, whatsappNumber: event.target.value }))} placeholder="Numero do WhatsApp da empresa" className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="rounded-xl border border-[#1A1A1A] bg-black/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Acessos do painel</p>
                    <p className="mt-1 text-[11px] text-zinc-500">Limite de 3 administradores cadastrados.</p>
                  </div>
                  <span className="rounded-full border border-[#1A1A1A] px-2 py-1 text-[11px] text-zinc-300">{adminAccounts.length}/3</span>
                </div>

                <div className="mt-3 space-y-2">
                  {adminAccounts.map((account) => (
                    <div key={account.username} className="flex items-center justify-between gap-3 rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold text-white">{account.name}</p>
                        <p className="text-xs text-zinc-400">@{account.username}</p>
                      </div>
                      {account.username === "admin" ? (
                        <span className="text-[11px] text-[#B2FF00]">Principal</span>
                      ) : (
                        <button type="button" onClick={() => void handleDeleteAdminUser(account.username)} className="rounded-lg border border-[#1A1A1A] p-2 text-zinc-300 hover:border-red-500 hover:text-red-300" aria-label={`Remover ${account.username}`}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCreateAdminUser} className="mt-3 grid gap-2">
                  <input
                    value={adminForm.name}
                    onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome do novo administrador"
                    disabled={isSavingAdminUser}
                    className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                  />
                  <input
                    value={adminForm.username}
                    onChange={(event) => setAdminForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="Usuario do novo administrador"
                    disabled={isSavingAdminUser}
                    className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                  />
                  <input
                    value={adminForm.password}
                    onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Senha inicial"
                    disabled={isSavingAdminUser}
                    className="rounded-xl border border-[#1A1A1A] bg-black px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={adminAccounts.length >= 3 || isSavingAdminUser} className="flex items-center justify-center gap-2 rounded-xl bg-[#00AAFF] py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50">
                    <UserPlus size={15} /> {isSavingAdminUser ? "Salvando..." : "Adicionar administrador"}
                  </button>
                </form>
              </div>

              <button type="button" onClick={handleSaveProfile} className="rounded-xl bg-[#B2FF00] py-2 font-black text-black">Salvar perfil</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
