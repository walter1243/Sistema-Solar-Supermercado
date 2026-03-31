import { sql } from "@vercel/postgres";
import { AdminSettings, AdminUser, CustomerAccount, CustomerAlert, Order, Product } from "@/types/domain";

const defaultSettings: AdminSettings = {
  pixKey: "",
  whatsappNumber: "",
  categories: ["Mercearia", "Carnes", "Bebidas", "Hortfruit", "Limpeza"],
  deliveryMinimum: 150,
  pickupMinimum: 100,
  cashbackSpendThreshold: 0,
  cashbackRewardValue: 0,
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

let schemaReady: Promise<void> | null = null;

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS admin_settings (
          id INTEGER PRIMARY KEY,
          pix_key TEXT NOT NULL DEFAULT '',
          whatsapp_number TEXT NOT NULL DEFAULT '',
          categories JSONB NOT NULL,
          delivery_minimum NUMERIC NOT NULL DEFAULT 150,
          pickup_minimum NUMERIC NOT NULL DEFAULT 100,
          cashback_spend_threshold NUMERIC NOT NULL DEFAULT 0,
          cashback_reward_value NUMERIC NOT NULL DEFAULT 0
        );
      `;

      await sql`
        ALTER TABLE admin_settings
        ADD COLUMN IF NOT EXISTS cashback_spend_threshold NUMERIC NOT NULL DEFAULT 0;
      `;

      await sql`
        ALTER TABLE admin_settings
        ADD COLUMN IF NOT EXISTS cashback_reward_value NUMERIC NOT NULL DEFAULT 0;
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          profile_image TEXT NOT NULL DEFAULT '',
          password TEXT NOT NULL
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price NUMERIC NOT NULL,
          image TEXT NOT NULL,
          category TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          full_name TEXT NOT NULL,
          phone TEXT UNIQUE NOT NULL,
          cpf TEXT NOT NULL DEFAULT '',
          password TEXT NOT NULL,
          street TEXT,
          street_number TEXT,
          reference TEXT,
          cashback_balance NUMERIC NOT NULL DEFAULT 0
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          items JSONB NOT NULL,
          customer_snapshot JSONB NOT NULL,
          total NUMERIC NOT NULL,
          status TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          fulfillment_method TEXT NOT NULL,
          payment_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
          cashback_granted BOOLEAN NOT NULL DEFAULT FALSE,
          customer_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS cashback_granted BOOLEAN NOT NULL DEFAULT FALSE;
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          read_at TIMESTAMPTZ
        );
      `;

      await sql`
        INSERT INTO admin_settings (
          id,
          pix_key,
          whatsapp_number,
          categories,
          delivery_minimum,
          pickup_minimum,
          cashback_spend_threshold,
          cashback_reward_value
        )
        VALUES (
          1,
          ${defaultSettings.pixKey},
          ${defaultSettings.whatsappNumber},
          ${JSON.stringify(defaultSettings.categories)}::jsonb,
          ${defaultSettings.deliveryMinimum},
          ${defaultSettings.pickupMinimum},
          ${defaultSettings.cashbackSpendThreshold},
          ${defaultSettings.cashbackRewardValue}
        )
        ON CONFLICT (id) DO NOTHING;
      `;

      await sql`
        INSERT INTO admin_users (id, username, name, profile_image, password)
        VALUES (1, ${defaultAdmin.username}, ${defaultAdmin.name}, ${defaultAdmin.profileImage || ""}, ${defaultAdmin.password || "123456"})
        ON CONFLICT (id) DO NOTHING;
      `;

      const { rows: productRows } = await sql`SELECT COUNT(*)::int AS count FROM products;`;
      if ((productRows[0]?.count || 0) === 0) {
        for (const product of seedProducts) {
          await sql`
            INSERT INTO products (id, name, price, image, category, created_at)
            VALUES (${product.id}, ${product.name}, ${product.price}, ${product.image}, ${product.category}, ${product.createdAt});
          `;
        }
      }
    })();
  }
  await schemaReady;
}

export async function getSettings(): Promise<AdminSettings> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM admin_settings WHERE id = 1 LIMIT 1;`;
  const data = rows[0];
  if (!data) return defaultSettings;
  return {
    pixKey: String(data.pix_key || ""),
    whatsappNumber: String(data.whatsapp_number || ""),
    categories: Array.isArray(data.categories) && data.categories.length ? data.categories : defaultSettings.categories,
    deliveryMinimum: Number(data.delivery_minimum || defaultSettings.deliveryMinimum),
    pickupMinimum: Number(data.pickup_minimum || defaultSettings.pickupMinimum),
    cashbackSpendThreshold: Number(data.cashback_spend_threshold || defaultSettings.cashbackSpendThreshold),
    cashbackRewardValue: Number(data.cashback_reward_value || defaultSettings.cashbackRewardValue),
  };
}

export async function saveSettings(settings: AdminSettings): Promise<AdminSettings> {
  await ensureSchema();
  const next: AdminSettings = {
    ...defaultSettings,
    ...settings,
    categories: settings.categories?.length ? settings.categories : defaultSettings.categories,
    deliveryMinimum: Number.isFinite(settings.deliveryMinimum) ? Number(settings.deliveryMinimum) : defaultSettings.deliveryMinimum,
    pickupMinimum: Number.isFinite(settings.pickupMinimum) ? Number(settings.pickupMinimum) : defaultSettings.pickupMinimum,
    cashbackSpendThreshold: Number.isFinite(settings.cashbackSpendThreshold) ? Number(settings.cashbackSpendThreshold) : defaultSettings.cashbackSpendThreshold,
    cashbackRewardValue: Number.isFinite(settings.cashbackRewardValue) ? Number(settings.cashbackRewardValue) : defaultSettings.cashbackRewardValue,
  };
  await sql`
    UPDATE admin_settings
    SET pix_key = ${next.pixKey},
        whatsapp_number = ${next.whatsappNumber},
        categories = ${JSON.stringify(next.categories)}::jsonb,
        delivery_minimum = ${next.deliveryMinimum},
        pickup_minimum = ${next.pickupMinimum},
        cashback_spend_threshold = ${next.cashbackSpendThreshold},
        cashback_reward_value = ${next.cashbackRewardValue}
    WHERE id = 1;
  `;
  return next;
}

export async function getAdminProfile(): Promise<AdminUser> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM admin_users WHERE id = 1 LIMIT 1;`;
  const data = rows[0];
  if (!data) return defaultAdmin;
  return {
    username: String(data.username || defaultAdmin.username),
    name: String(data.name || defaultAdmin.name),
    profileImage: String(data.profile_image || ""),
    password: String(data.password || defaultAdmin.password || "123456"),
  };
}

export async function saveAdminProfile(profile: AdminUser): Promise<AdminUser> {
  await ensureSchema();
  const next = {
    ...defaultAdmin,
    ...profile,
  };
  await sql`
    UPDATE admin_users
    SET username = ${next.username},
        name = ${next.name},
        profile_image = ${next.profileImage || ""},
        password = ${next.password || "123456"}
    WHERE id = 1;
  `;
  return next;
}

export async function getProducts(): Promise<Product[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM products ORDER BY created_at DESC;`;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    price: Number(row.price),
    image: String(row.image),
    category: String(row.category),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function saveProducts(products: Product[]): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM products;`;
  for (const product of products) {
    await sql`
      INSERT INTO products (id, name, price, image, category, created_at)
      VALUES (${product.id}, ${product.name}, ${product.price}, ${product.image}, ${product.category}, ${product.createdAt});
    `;
  }
}

export async function getOrders(): Promise<Order[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM orders ORDER BY created_at DESC;`;
  return rows.map((row) => ({
    id: String(row.id),
    items: row.items,
    customer: row.customer_snapshot,
    total: Number(row.total),
    status: row.status,
    paymentMethod: row.payment_method,
    fulfillmentMethod: row.fulfillment_method,
    paymentConfirmed: Boolean(row.payment_confirmed),
    cashbackGranted: Boolean(row.cashback_granted),
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  })) as Order[];
}

export async function saveOrders(orders: Order[]): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM orders;`;
  for (const order of orders) {
    await sql`
      INSERT INTO orders (id, items, customer_snapshot, total, status, payment_method, fulfillment_method, payment_confirmed, cashback_granted, customer_id, created_at)
      VALUES (
        ${order.id},
        ${JSON.stringify(order.items)}::jsonb,
        ${JSON.stringify(order.customer)}::jsonb,
        ${order.total},
        ${order.status},
        ${order.paymentMethod},
        ${order.fulfillmentMethod},
        ${Boolean(order.paymentConfirmed)},
        ${Boolean(order.cashbackGranted)},
        ${order.customerId || null},
        ${order.createdAt}
      );
    `;
  }
}

export async function getCustomerById(id: string): Promise<CustomerAccount | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM customers WHERE id = ${id} LIMIT 1;`;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    phone: String(row.phone),
    cpf: String(row.cpf || ""),
    password: String(row.password),
    street: row.street ? String(row.street) : undefined,
    number: row.street_number ? String(row.street_number) : undefined,
    reference: row.reference ? String(row.reference) : undefined,
    cashbackBalance: Number(row.cashback_balance || 0),
  };
}

export async function getCustomerByPhone(phone: string): Promise<CustomerAccount | null> {
  await ensureSchema();
  const normalized = normalizePhone(phone);
  const { rows } = await sql`SELECT * FROM customers WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${normalized} LIMIT 1;`;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    phone: String(row.phone),
    cpf: String(row.cpf || ""),
    password: String(row.password),
    street: row.street ? String(row.street) : undefined,
    number: row.street_number ? String(row.street_number) : undefined,
    reference: row.reference ? String(row.reference) : undefined,
    cashbackBalance: Number(row.cashback_balance || 0),
  };
}

export async function saveCustomer(account: CustomerAccount): Promise<CustomerAccount> {
  await ensureSchema();
  await sql`
    INSERT INTO customers (id, full_name, phone, cpf, password, street, street_number, reference, cashback_balance)
    VALUES (
      ${account.id},
      ${account.fullName},
      ${account.phone},
      ${account.cpf || ""},
      ${account.password},
      ${account.street || null},
      ${account.number || null},
      ${account.reference || null},
      ${account.cashbackBalance || 0}
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        cpf = EXCLUDED.cpf,
        password = EXCLUDED.password,
        street = EXCLUDED.street,
        street_number = EXCLUDED.street_number,
        reference = EXCLUDED.reference,
        cashback_balance = EXCLUDED.cashback_balance;
  `;
  return account;
}

export async function getCustomerAlerts(customerId: string): Promise<CustomerAlert[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM alerts WHERE customer_id = ${customerId} ORDER BY created_at DESC LIMIT 100;`;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    message: String(row.message),
    createdAt: new Date(row.created_at).toISOString(),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : undefined,
  }));
}

export async function addCustomerAlert(customerId: string, title: string, message: string): Promise<CustomerAlert> {
  await ensureSchema();
  const alert: CustomerAlert = {
    id: crypto.randomUUID(),
    title,
    message,
    createdAt: new Date().toISOString(),
  };
  await sql`
    INSERT INTO alerts (id, customer_id, title, message, created_at)
    VALUES (${alert.id}, ${customerId}, ${title}, ${message}, ${alert.createdAt});
  `;
  return alert;
}

export async function markCustomerAlertAsRead(customerId: string, alertId: string): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE alerts
    SET read_at = NOW()
    WHERE id = ${alertId} AND customer_id = ${customerId};
  `;
}
