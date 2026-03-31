import { kv } from "@vercel/kv";
import { AdminSettings, AdminUser, CustomerAccount, Order, Product } from "@/types/domain";

const KEYS = {
  products: "solar:products",
  orders: "solar:orders",
  settings: "solar:settings",
  adminProfile: "solar:admin:profile",
};

const defaultSettings: AdminSettings = {
  pixKey: "",
  whatsappNumber: "",
  categories: ["Mercearia", "Carnes", "Bebidas", "Hortfruit", "Limpeza"],
  deliveryMinimum: 150,
  pickupMinimum: 100,
};

const defaultAdmin: AdminUser = {
  username: "admin",
  name: "Administrador Solar",
  profileImage: "",
  password: "123456",
};

const seedProducts: Product[] = [
  {
    id: "p-1",
    name: "Arroz Tipo 1 - 5kg",
    price: 32.9,
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=640&q=80",
    category: "Mercearia",
    createdAt: new Date().toISOString(),
  },
  {
    id: "p-2",
    name: "Feijao Carioca - 1kg",
    price: 9.5,
    image: "https://images.unsplash.com/photo-1592928302636-c83cf1e1a6ba?auto=format&fit=crop&w=640&q=80",
    category: "Mercearia",
    createdAt: new Date().toISOString(),
  },
  {
    id: "p-3",
    name: "Detergente Limao 500ml",
    price: 2.99,
    image: "https://images.unsplash.com/photo-1583947582886-f40ec95dd752?auto=format&fit=crop&w=640&q=80",
    category: "Limpeza",
    createdAt: new Date().toISOString(),
  },
];

export function customerKey(id: string) {
  return `solar:customer:${id}`;
}

export function customerByPhoneKey(phone: string) {
  return `solar:customer:phone:${phone.replace(/\D/g, "")}`;
}

export async function getSettings(): Promise<AdminSettings> {
  const data = (await kv.get<AdminSettings>(KEYS.settings)) || null;
  if (!data) {
    await kv.set(KEYS.settings, defaultSettings);
    return defaultSettings;
  }
  return {
    ...defaultSettings,
    ...data,
    categories: data.categories?.length ? data.categories : defaultSettings.categories,
    deliveryMinimum: Number.isFinite(data.deliveryMinimum) ? Number(data.deliveryMinimum) : defaultSettings.deliveryMinimum,
    pickupMinimum: Number.isFinite(data.pickupMinimum) ? Number(data.pickupMinimum) : defaultSettings.pickupMinimum,
  };
}

export async function saveSettings(settings: AdminSettings): Promise<AdminSettings> {
  const next: AdminSettings = {
    ...defaultSettings,
    ...settings,
    categories: settings.categories?.length ? settings.categories : defaultSettings.categories,
    deliveryMinimum: Number.isFinite(settings.deliveryMinimum) ? Number(settings.deliveryMinimum) : defaultSettings.deliveryMinimum,
    pickupMinimum: Number.isFinite(settings.pickupMinimum) ? Number(settings.pickupMinimum) : defaultSettings.pickupMinimum,
  };
  await kv.set(KEYS.settings, next);
  return next;
}

export async function getAdminProfile(): Promise<AdminUser> {
  const data = (await kv.get<AdminUser>(KEYS.adminProfile)) || null;
  if (!data) {
    await kv.set(KEYS.adminProfile, defaultAdmin);
    return defaultAdmin;
  }
  return {
    ...defaultAdmin,
    ...data,
  };
}

export async function saveAdminProfile(profile: AdminUser): Promise<AdminUser> {
  const next = {
    ...defaultAdmin,
    ...profile,
  };
  await kv.set(KEYS.adminProfile, next);
  return next;
}

export async function getProducts(): Promise<Product[]> {
  const data = (await kv.get<Product[]>(KEYS.products)) || null;
  if (!data || !data.length) {
    await kv.set(KEYS.products, seedProducts);
    return seedProducts;
  }
  return data;
}

export async function saveProducts(products: Product[]): Promise<void> {
  await kv.set(KEYS.products, products);
}

export async function getOrders(): Promise<Order[]> {
  return (await kv.get<Order[]>(KEYS.orders)) || [];
}

export async function saveOrders(orders: Order[]): Promise<void> {
  await kv.set(KEYS.orders, orders);
}

export async function getCustomerById(id: string): Promise<CustomerAccount | null> {
  return ((await kv.get<CustomerAccount>(customerKey(id))) || null) as CustomerAccount | null;
}

export async function getCustomerByPhone(phone: string): Promise<CustomerAccount | null> {
  const customerId = (await kv.get<string>(customerByPhoneKey(phone))) || null;
  if (!customerId) return null;
  return getCustomerById(customerId);
}

export async function saveCustomer(account: CustomerAccount): Promise<CustomerAccount> {
  await kv.set(customerKey(account.id), account);
  await kv.set(customerByPhoneKey(account.phone), account.id);
  return account;
}
