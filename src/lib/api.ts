"use client";

import { AdminSettings, AdminUser, Cashier, CustomerAccount, CustomerAlert, DashboardSummary, Order, Product, ReceivableAccount } from "@/types/domain";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapData<T>(payload: unknown): T | null {
  if (Array.isArray(payload)) return payload as T;
  if (isObject(payload) && "data" in payload) return payload.data as T;
  if (isObject(payload) && "items" in payload) return payload.items as T;
  return (payload as T) || null;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    if (res.status === 204) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getProductsCatalog(): Promise<Product[]> {
  const remote = unwrapData<Product[]>(await apiFetch<unknown>("/api/products", { method: "GET" }));
  return remote || [];
}

export async function createProduct(product: Product): Promise<Product> {
  const remote = unwrapData<Product>(
    await apiFetch<unknown>("/api/products", {
      method: "POST",
      body: JSON.stringify(product),
    }),
  );
  return remote || product;
}

export async function updateProductRemote(product: Product): Promise<Product> {
  const remote = unwrapData<Product>(
    await apiFetch<unknown>("/api/products", {
      method: "PUT",
      body: JSON.stringify(product),
    }),
  );
  return remote || product;
}

export async function deleteProductRemote(productId: string): Promise<boolean> {
  const response = await apiFetch<{ success?: boolean }>("/api/products", {
    method: "DELETE",
    body: JSON.stringify({ id: productId }),
  });
  if (!response) return false;
  return Boolean(response.success);
}

export async function getAdminSettingsRemote(): Promise<AdminSettings> {
  const remote = unwrapData<AdminSettings>(await apiFetch<unknown>("/api/settings", { method: "GET" }));
  return remote || {
    pixKey: "",
    whatsappNumber: "",
    categories: ["Mercearia", "Carnes", "Bebidas", "Hortfruit", "Limpeza"],
    promotionProductIds: [],
    promotionStartDate: "",
    promotionEndDate: "",
    promotionPrices: {},
    deliveryMinimum: 150,
    pickupMinimum: 100,
    cashbackSpendThreshold: 0,
    cashbackRewardValue: 0,
    cardDebitFeePercent: 3,
    cardCreditFeePercent: 5,
  };
}

export async function saveAdminSettingsRemote(settings: AdminSettings): Promise<AdminSettings | null> {
  const remote = unwrapData<AdminSettings>(
    await apiFetch<unknown>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  );
  return remote || null;
}

export async function registerCustomerRemote(account: CustomerAccount): Promise<CustomerAccount> {
  const remote = unwrapData<CustomerAccount>(
    await apiFetch<unknown>("/api/customers/register", {
      method: "POST",
      body: JSON.stringify(account),
    }),
  );
  return remote || account;
}

export async function loginCustomerRemote(phone: string, password: string): Promise<CustomerAccount | null> {
  const remote = unwrapData<CustomerAccount>(
    await apiFetch<unknown>("/api/customers/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    }),
  );
  return remote || null;
}

export async function getCustomerSessionRemote(): Promise<CustomerAccount | null> {
  const remote = unwrapData<CustomerAccount | null>(await apiFetch<unknown>("/api/customers/session", { method: "GET" }));
  return remote || null;
}

export async function clearCustomerSessionRemote(): Promise<void> {
  await apiFetch<unknown>("/api/customers/session", { method: "DELETE" });
}

export async function updateCustomerAccountRemote(account: CustomerAccount): Promise<CustomerAccount> {
  const remote = unwrapData<CustomerAccount>(
    await apiFetch<unknown>(`/api/customers/${account.id}`, {
      method: "PUT",
      body: JSON.stringify(account),
    }),
  );
  return remote || account;
}

export async function postOrder(order: Order): Promise<boolean> {
  const data = await apiFetch<{ success?: boolean } | { data?: Order } | Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });

  const remoteOrder = unwrapData<Order>(data);
  if (remoteOrder) return true;
  if (isObject(data) && "success" in data) return Boolean(data.success);
  return false;
}

export async function getDeliveryList(): Promise<Order[]> {
  const remote = unwrapData<Order[]>(await apiFetch<unknown>("/api/deliveries", { method: "GET" }));
  return remote || [];
}

export async function getOrdersForAdmin(): Promise<Order[]> {
  const remote = unwrapData<Order[]>(await apiFetch<unknown>("/api/orders", { method: "GET" }));
  return remote || [];
}

export async function getCustomersForAdmin(): Promise<CustomerAccount[]> {
  const remote = unwrapData<CustomerAccount[]>(await apiFetch<unknown>("/api/customers", { method: "GET" }));
  return remote || [];
}

export async function updateOrderStatusRemote(orderId: string, status: Order["status"], paymentConfirmed?: boolean): Promise<Order | null> {
  const remote = unwrapData<Order>(
    await apiFetch<unknown>(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, paymentConfirmed }),
    }),
  );
  return remote || null;
}

export async function uploadOrderPixProofRemote(orderId: string, pixProofFileName: string, pixProofDataUrl: string): Promise<Order | null> {
  const remote = unwrapData<Order>(
    await apiFetch<unknown>(`/api/orders/${orderId}/proof`, {
      method: "PATCH",
      body: JSON.stringify({ pixProofFileName, pixProofDataUrl }),
    }),
  );
  return remote || null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const remote = unwrapData<DashboardSummary>(await apiFetch<unknown>("/api/dashboard", { method: "GET" }));
  return remote || { revenueToday: 0, ordersToday: 0, productsToday: 0, totalProducts: 0 };
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

export async function loginAdminRemote(username: string, password: string): Promise<AdminUser | null> {
  const remote = unwrapData<AdminUser>(
    await apiFetch<unknown>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  );
  return remote || null;
}

export async function getAdminSessionRemote(): Promise<AdminUser | null> {
  const remote = unwrapData<AdminUser | null>(await apiFetch<unknown>("/api/admin/session", { method: "GET" }));
  return remote || null;
}

export async function clearAdminSessionRemote(): Promise<void> {
  await apiFetch<unknown>("/api/admin/session", { method: "DELETE" });
}

export async function saveAdminProfileRemote(profile: AdminUser): Promise<AdminUser> {
  const remote = unwrapData<AdminUser>(
    await apiFetch<unknown>("/api/admin/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    }),
  );
  return remote || profile;
}

export async function listAdminUsersRemote(): Promise<AdminUser[]> {
  const remote = unwrapData<AdminUser[]>(await apiFetch<unknown>("/api/admin/users", { method: "GET" }));
  return remote || [];
}

export async function createAdminUserRemote(profile: AdminUser): Promise<{ user: AdminUser | null; error?: string }> {
  try {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const payload = (await res.json()) as { data?: AdminUser; error?: string };
    if (!res.ok) {
      return { user: null, error: payload.error || "Falha ao criar administrador." };
    }
    return { user: payload.data || null };
  } catch {
    return { user: null, error: "Falha ao criar administrador." };
  }
}

export async function deleteAdminUserRemote(username: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok) {
      return { success: false, error: payload.error || "Falha ao remover administrador." };
    }
    return { success: Boolean(payload.success) };
  } catch {
    return { success: false, error: "Falha ao remover administrador." };
  }
}

export async function listCashiersRemote(): Promise<Cashier[]> {
  const remote = unwrapData<Cashier[]>(await apiFetch<unknown>("/api/cashiers", { method: "GET" }));
  return remote || [];
}

export async function createCashierRemote(name: string): Promise<{ cashier: Cashier | null; error?: string }> {
  try {
    const res = await fetch("/api/cashiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const payload = (await res.json()) as { data?: Cashier; error?: string };
    if (!res.ok) {
      return { cashier: null, error: payload.error || "Falha ao cadastrar caixa." };
    }
    return { cashier: payload.data || null };
  } catch {
    return { cashier: null, error: "Falha ao cadastrar caixa." };
  }
}

export async function deleteCashierRemote(cashierId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/cashiers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cashierId }),
    });
    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok) {
      return { success: false, error: payload.error || "Falha ao excluir caixa." };
    }
    return { success: Boolean(payload.success) };
  } catch {
    return { success: false, error: "Falha ao excluir caixa." };
  }
}

export async function listReceivableAccountsRemote(): Promise<ReceivableAccount[]> {
  const remote = unwrapData<ReceivableAccount[]>(await apiFetch<unknown>("/api/receivables", { method: "GET" }));
  return remote || [];
}

export async function createReceivableAccountRemote(account: Omit<ReceivableAccount, "id" | "createdAt">): Promise<{ account: ReceivableAccount | null; error?: string }> {
  try {
    const res = await fetch("/api/receivables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    const payload = (await res.json()) as { data?: ReceivableAccount; error?: string };
    if (!res.ok) {
      return { account: null, error: payload.error || "Falha ao salvar conta recebida." };
    }
    return { account: payload.data || null };
  } catch {
    return { account: null, error: "Falha ao salvar conta recebida." };
  }
}

export async function updateReceivableAccountRemote(id: string, account: Omit<ReceivableAccount, "id" | "createdAt">): Promise<{ account: ReceivableAccount | null; error?: string }> {
  try {
    const res = await fetch(`/api/receivables/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    const payload = (await res.json()) as { data?: ReceivableAccount; error?: string };
    if (!res.ok) {
      return { account: null, error: payload.error || "Falha ao atualizar conta recebida." };
    }
    return { account: payload.data || null };
  } catch {
    return { account: null, error: "Falha ao atualizar conta recebida." };
  }
}
