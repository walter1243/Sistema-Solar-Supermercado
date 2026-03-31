"use client";

import { AdminSettings, Order, Product } from "@/types/domain";

const PRODUCTS_KEY = "solar_products";
const ORDERS_KEY = "solar_orders";
const SETTINGS_KEY = "solar_admin_settings";

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

export function getOrders(): Order[] {
  return load<Order[]>(ORDERS_KEY, []);
}

export function addOrder(order: Order) {
  const orders = getOrders();
  save(ORDERS_KEY, [order, ...orders]);
}

export function getAdminSettings(): AdminSettings {
  return load<AdminSettings>(SETTINGS_KEY, defaultSettings);
}

export function saveAdminSettings(settings: AdminSettings) {
  save(SETTINGS_KEY, settings);
}
