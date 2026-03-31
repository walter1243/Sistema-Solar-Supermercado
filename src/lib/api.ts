"use client";

import { DashboardSummary, Order } from "@/types/domain";
import { getOrders, getProducts } from "./storage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

async function safeFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function postOrder(order: Order): Promise<boolean> {
  const data = await safeFetch<{ success: boolean }>("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
  return Boolean(data?.success);
}

export async function getDeliveryList(): Promise<Order[]> {
  const remote = await safeFetch<Order[]>("/deliveries", { method: "GET" });
  if (remote?.length) return remote;
  return getOrders().filter((order) => !!order.customer.address);
}

export async function getOrdersForAdmin(): Promise<Order[]> {
  const remote = await safeFetch<Order[]>("/orders", { method: "GET" });
  if (remote?.length) return remote;
  return getOrders();
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const remote = await safeFetch<DashboardSummary>("/dashboard", { method: "GET" });
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
