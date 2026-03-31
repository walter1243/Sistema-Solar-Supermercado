"use client";

import { AdminSettings, CustomerAccount, CustomerAlert, DashboardSummary, Order, Product } from "@/types/domain";
import {
  getAdminSettings,
  getOrders,
  getProducts,
  replaceOrders,
  replaceProducts,
  saveAdminSettings,
  saveCustomerSession,
  upsertCustomerAccount,
} from "./storage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function hasRemoteApi() {
  return Boolean(API_BASE);
}

async function safeFetch<T>(paths: string | string[], init?: RequestInit): Promise<T | null> {
  if (!API_BASE) return null;

  const candidates = Array.isArray(paths) ? paths : [paths];

  for (const path of candidates) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
        cache: "no-store",
      });
      if (!res.ok) continue;
      if (res.status === 204) return null;
      return (await res.json()) as T;
    } catch {
      continue;
    }
  }

  return null;
}

function unwrapData<T>(payload: unknown): T | null {
  if (Array.isArray(payload)) return payload as T;
  if (isObject(payload) && "data" in payload) return payload.data as T;
  if (isObject(payload) && "items" in payload) return payload.items as T;
  return (payload as T) || null;
}

function orderPaths(suffix = "") {
  return [`/orders${suffix}`, `/api/orders${suffix}`];
}

function productPaths(suffix = "") {
  return [`/products${suffix}`, `/api/products${suffix}`];
}

function settingsPaths() {
  return ["/settings", "/admin/settings", "/api/settings", "/api/admin/settings"];
}

function mergeAdminSettings(base: AdminSettings, incoming?: Partial<AdminSettings> | null): AdminSettings {
  if (!incoming) return base;
  return {
    pixKey: incoming.pixKey?.trim() ? incoming.pixKey : base.pixKey,
    whatsappNumber: incoming.whatsappNumber?.trim() ? incoming.whatsappNumber : base.whatsappNumber,
    categories: incoming.categories?.length ? incoming.categories : base.categories,
  };
}

function customerRegisterPaths() {
  return ["/customers/register", "/auth/customers/register", "/api/customers/register", "/api/auth/customers/register"];
}

function customerLoginPaths() {
  return ["/customers/login", "/auth/customers/login", "/api/customers/login", "/api/auth/customers/login"];
}

function customerUpdatePaths(customerId: string) {
  return [`/customers/${customerId}`, `/api/customers/${customerId}`];
}

export async function getProductsCatalog(): Promise<Product[]> {
  const remote = unwrapData<Product[]>(await safeFetch<unknown>(productPaths(), { method: "GET" }));
  if (remote?.length) {
    replaceProducts(remote);
    return remote;
  }
  return getProducts();
}

export async function createProduct(product: Product): Promise<Product> {
  const remote = unwrapData<Product>(
    await safeFetch<unknown>(productPaths(), {
      method: "POST",
      body: JSON.stringify(product),
    }),
  );
  const nextProduct = remote || product;
  replaceProducts([nextProduct, ...getProducts().filter((item) => item.id !== nextProduct.id)]);
  return nextProduct;
}

export async function getAdminSettingsRemote(): Promise<AdminSettings> {
  const local = getAdminSettings();
  const remote = unwrapData<AdminSettings>(await safeFetch<unknown>(settingsPaths(), { method: "GET" }));
  if (remote) {
    const merged = mergeAdminSettings(local, remote);
    saveAdminSettings(merged);
    return merged;
  }
  return local;
}

export async function saveAdminSettingsRemote(settings: AdminSettings): Promise<AdminSettings> {
  const remote = unwrapData<AdminSettings>(
    await safeFetch<unknown>(settingsPaths(), {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  );
  const nextSettings = mergeAdminSettings(settings, remote);
  saveAdminSettings(nextSettings);
  return nextSettings;
}

export async function registerCustomerRemote(account: CustomerAccount): Promise<CustomerAccount> {
  const remote = unwrapData<CustomerAccount>(
    await safeFetch<unknown>(customerRegisterPaths(), {
      method: "POST",
      body: JSON.stringify(account),
    }),
  );
  const nextAccount = remote || account;
  upsertCustomerAccount(nextAccount);
  saveCustomerSession(nextAccount);
  return nextAccount;
}

export async function loginCustomerRemote(phone: string, password: string): Promise<CustomerAccount | null> {
  const remote = unwrapData<CustomerAccount>(
    await safeFetch<unknown>(customerLoginPaths(), {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    }),
  );
  if (!remote) return null;
  upsertCustomerAccount(remote);
  saveCustomerSession(remote);
  return remote;
}

export async function updateCustomerAccountRemote(account: CustomerAccount): Promise<CustomerAccount> {
  const remote = unwrapData<CustomerAccount>(
    await safeFetch<unknown>(customerUpdatePaths(account.id), {
      method: "PUT",
      body: JSON.stringify(account),
    }),
  );
  const nextAccount = remote || account;
  upsertCustomerAccount(nextAccount);
  saveCustomerSession(nextAccount);
  return nextAccount;
}

export async function postOrder(order: Order): Promise<boolean> {
  const data = await safeFetch<{ success?: boolean } | { data?: Order } | Order>(orderPaths(), {
    method: "POST",
    body: JSON.stringify(order),
  });

  const remoteOrder = unwrapData<Order>(data);
  if (remoteOrder) {
    replaceOrders([remoteOrder, ...getOrders().filter((item) => item.id !== remoteOrder.id)]);
    return true;
  }

  if (isObject(data) && "success" in data) {
    return Boolean(data.success);
  }

  return !hasRemoteApi();
}

export async function getDeliveryList(): Promise<Order[]> {
  const remote = unwrapData<Order[]>(await safeFetch<unknown>(["/deliveries", "/api/deliveries", ...orderPaths("?fulfillmentMethod=entrega")], { method: "GET" }));
  if (remote?.length) {
    replaceOrders(remote);
    return remote;
  }
  return getOrders().filter((order) => !!order.customer.address);
}

export async function getOrdersForAdmin(): Promise<Order[]> {
  const remote = unwrapData<Order[]>(await safeFetch<unknown>(orderPaths(), { method: "GET" }));
  if (remote?.length) {
    replaceOrders(remote);
    return remote;
  }
  return getOrders();
}

export async function updateOrderStatusRemote(orderId: string, status: Order["status"], paymentConfirmed?: boolean): Promise<Order | null> {
  const remote = unwrapData<Order>(
    await safeFetch<unknown>([`/orders/${orderId}/status`, `/api/orders/${orderId}/status`], {
      method: "PATCH",
      body: JSON.stringify({ status, paymentConfirmed }),
    }),
  );

  if (remote) {
    replaceOrders(getOrders().map((order) => (order.id === orderId ? remote : order)));
    return remote;
  }

  return null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const remote = unwrapData<DashboardSummary>(await safeFetch<unknown>(["/dashboard", "/api/dashboard"], { method: "GET" }));
  if (remote) return remote;

  const today = new Date().toDateString();
  const orders = getOrders();
  const products = getProducts();

  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === today);
  const todayProducts = products.filter((product) => new Date(product.createdAt).toDateString() === today);

  return {
    revenueToday: todayOrders.reduce((sum, order) => sum + order.total, 0),
    ordersToday: todayOrders.length,
    productsToday: todayProducts.length,
    totalProducts: products.length,
  };
}

export async function sendCustomerAlertRemote(customerId: string, title: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, title, message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getCustomerAlertsRemote(customerId: string): Promise<CustomerAlert[]> {
  try {
    const res = await fetch(`/api/alerts?customerId=${encodeURIComponent(customerId)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: CustomerAlert[] };
    return Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
}

export async function markCustomerAlertAsReadRemote(customerId: string, alertId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, alertId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
