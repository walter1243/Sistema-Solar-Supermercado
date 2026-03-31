"use client";

import { AdminSettings, AdminUser, CustomerAccount, Order, Product } from "@/types/domain";

const PRODUCTS_KEY = "solar_products";
const ORDERS_KEY = "solar_orders";
const SETTINGS_KEY = "solar_admin_settings";
const ADMIN_SESSION_KEY = "solar_admin_session";
const ADMIN_PROFILE_KEY = "solar_admin_profile";
const CUSTOMER_ACCOUNTS_KEY = "solar_customer_accounts";
const CUSTOMER_SESSION_KEY = "solar_customer_session";

const seedProducts: Product[] = [
  {
    id: crypto.randomUUID(),
    name: "Arroz Tipo 1 - 5kg",
    price: 32.9,
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=640&q=80",
    category: "Mercearia",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    name: "Feijao Carioca - 1kg",
    price: 9.5,
    image: "https://images.unsplash.com/photo-1592928302636-c83cf1e1a6ba?auto=format&fit=crop&w=640&q=80",
    category: "Mercearia",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    name: "Detergente Limao 500ml",
    price: 2.99,
    image: "https://images.unsplash.com/photo-1583947582886-f40ec95dd752?auto=format&fit=crop&w=640&q=80",
    category: "Limpeza",
    createdAt: new Date().toISOString(),
  },
];

const defaultSettings: AdminSettings = {
  pixKey: "",
  whatsappNumber: "",
  categories: ["Mercearia", "Carnes", "Bebidas", "Hortfruit", "Limpeza"],
};

const defaultAdminUser: AdminUser = {
  username: "admin",
  name: "Administrador Solar",
  profileImage: "",
  password: "123456",
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getProducts(): Product[] {
  const products = load<Product[]>(PRODUCTS_KEY, []);
  if (!products.length) {
    save(PRODUCTS_KEY, seedProducts);
    return seedProducts;
  }
  return products;
}

export function addProduct(product: Product) {
  const products = getProducts();
  save(PRODUCTS_KEY, [product, ...products]);
}

export function replaceProducts(products: Product[]) {
  save(PRODUCTS_KEY, products);
}

export function getOrders(): Order[] {
  return load<Order[]>(ORDERS_KEY, []);
}

export function addOrder(order: Order) {
  const orders = getOrders();
  save(ORDERS_KEY, [order, ...orders]);
}

export function replaceOrders(orders: Order[]) {
  save(ORDERS_KEY, orders);
}

export function updateOrder(updatedOrder: Order) {
  const orders = getOrders().map((order) => (order.id === updatedOrder.id ? updatedOrder : order));
  save(ORDERS_KEY, orders);
}

export function updateOrderStatus(orderId: string, status: Order["status"], paymentConfirmed?: boolean) {
  const orders = getOrders().map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      status,
      paymentConfirmed: paymentConfirmed ?? order.paymentConfirmed,
    };
  });
  save(ORDERS_KEY, orders);

  const updated = orders.find((order) => order.id === orderId);
  if (updated && updated.customerId && updated.status === "entregue" && updated.paymentConfirmed) {
    applyCashback(updated.customerId, updated.total);
  }
}

export function getAdminSettings(): AdminSettings {
  const settings = load<AdminSettings>(SETTINGS_KEY, defaultSettings);
  return {
    ...defaultSettings,
    ...settings,
    categories: settings.categories?.length ? settings.categories : defaultSettings.categories,
  };
}

export function saveAdminSettings(settings: AdminSettings) {
  save(SETTINGS_KEY, {
    ...defaultSettings,
    ...settings,
  });
}

export function authenticateAdmin(username: string, password: string): AdminUser | null {
  const adminProfile = getAdminProfile();
  if (username === adminProfile.username && password === adminProfile.password) {
    save(ADMIN_SESSION_KEY, adminProfile);
    return adminProfile;
  }
  return null;
}

export function getAdminSession(): AdminUser | null {
  return load<AdminUser | null>(ADMIN_SESSION_KEY, null);
}

export function getAdminProfile(): AdminUser {
  return load<AdminUser>(ADMIN_PROFILE_KEY, defaultAdminUser);
}

export function saveAdminProfile(profile: AdminUser) {
  save(ADMIN_PROFILE_KEY, {
    ...defaultAdminUser,
    ...profile,
  });

  const currentSession = getAdminSession();
  if (currentSession) {
    save(ADMIN_SESSION_KEY, {
      ...currentSession,
      ...profile,
    });
  }
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function getCustomerAccounts(): CustomerAccount[] {
  return load<CustomerAccount[]>(CUSTOMER_ACCOUNTS_KEY, []);
}

export function registerCustomer(account: CustomerAccount) {
  const accounts = getCustomerAccounts();
  save(CUSTOMER_ACCOUNTS_KEY, [account, ...accounts]);
  save(CUSTOMER_SESSION_KEY, account);
}

export function upsertCustomerAccount(account: CustomerAccount) {
  const accounts = getCustomerAccounts();
  const exists = accounts.some((item) => item.id === account.id);
  save(CUSTOMER_ACCOUNTS_KEY, exists ? accounts.map((item) => (item.id === account.id ? account : item)) : [account, ...accounts]);
}

export function loginCustomer(phone: string, password: string): CustomerAccount | null {
  const account = getCustomerAccounts().find((item) => item.phone === phone && item.password === password);
  if (!account) return null;
  save(CUSTOMER_SESSION_KEY, account);
  return account;
}

export function getCustomerSession(): CustomerAccount | null {
  return load<CustomerAccount | null>(CUSTOMER_SESSION_KEY, null);
}

export function saveCustomerSession(account: CustomerAccount) {
  save(CUSTOMER_SESSION_KEY, account);
}

export function clearCustomerSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
}

export function updateCustomerAccount(updatedAccount: CustomerAccount) {
  upsertCustomerAccount(updatedAccount);
  const current = getCustomerSession();
  if (current?.id === updatedAccount.id) {
    saveCustomerSession(updatedAccount);
  }
}

export function applyCashback(customerId: string, orderTotal: number) {
  const accounts = getCustomerAccounts();
  const account = accounts.find((item) => item.id === customerId);
  if (!account) return;
  const cashbackValue = Number((orderTotal * 0.02).toFixed(2));
  updateCustomerAccount({
    ...account,
    cashbackBalance: Number((account.cashbackBalance + cashbackValue).toFixed(2)),
  });
}
