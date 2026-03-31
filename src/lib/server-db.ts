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

const defaultAdmins: Array<{ id: number; user: AdminUser }> = [
  {
    id: 1,
    user: {
      username: "admin",
      name: "Administrador Solar",
      profileImage: "",
      password: "123456",
    },
  },
  {
    id: 2,
    user: {
      username: "admin2",
      name: "Administrador Solar 2",
      profileImage: "",
      password: "123456",
    },
  },
  {
    id: 3,
    user: {
      username: "admin3",
      name: "Administrador Solar 3",
      profileImage: "",
      password: "123456",
    },
  },
];

const defaultAdmin = defaultAdmins[0].user;

const seedProducts: Product[] = [
  {
    id: "p-1",
    name: "Arroz Tipo 1 - 5kg",
    price: 32.9,
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=640&q=80",
    category: "Mercearia",
    unit: "und",
    createdAt: new Date().toISOString(),
  },
  {
    id: "p-2",
    name: "Feijao Carioca - 1kg",
    price: 9.5,
    image: "https://images.unsplash.com/photo-1592928302636-c83cf1e1a6ba?auto=format&fit=crop&w=640&q=80",
    category: "Mercearia",
    unit: "und",
    createdAt: new Date().toISOString(),
  },
  {
    id: "p-3",
    name: "Detergente Limao 500ml",
    price: 2.99,
    image: "https://images.unsplash.com/photo-1583947582886-f40ec95dd752?auto=format&fit=crop&w=640&q=80",
    category: "Limpeza",
    unit: "und",
    createdAt: new Date().toISOString(),
  },
];

let schemaReady: Promise<void> | null = null;

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function mapAdminRow(row: Record<string, unknown> | undefined): AdminUser | null {
  if (!row) return null;
  return {
    id: Number(row.id || 0) || undefined,
    username: String(row.username || defaultAdmin.username),
    name: String(row.name || defaultAdmin.name),
    profileImage: String(row.profile_image || ""),
    password: String(row.password || defaultAdmin.password || "123456"),
  };
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
          unit TEXT NOT NULL DEFAULT 'und',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await sql`
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'und';
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
          pix_proof_file_name TEXT,
          pix_proof_data_url TEXT,
          pix_proof_uploaded_at TIMESTAMPTZ,
          customer_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS cashback_granted BOOLEAN NOT NULL DEFAULT FALSE;
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS pix_proof_file_name TEXT;
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS pix_proof_data_url TEXT;
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS pix_proof_uploaded_at TIMESTAMPTZ;
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
        UPDATE orders AS o
        SET customer_id = c.id
        FROM customers AS c
        WHERE o.customer_id IS NULL
          AND regexp_replace(COALESCE(o.customer_snapshot->>'phone', ''), '[^0-9]', '', 'g') = regexp_replace(c.phone, '[^0-9]', '', 'g');
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

      for (const admin of defaultAdmins) {
        await sql`
          INSERT INTO admin_users (id, username, name, profile_image, password)
          VALUES (${admin.id}, ${admin.user.username}, ${admin.user.name}, ${admin.user.profileImage || ""}, ${admin.user.password || "123456"})
          ON CONFLICT (id) DO NOTHING;
        `;
      }

      const { rows: productRows } = await sql`SELECT COUNT(*)::int AS count FROM products;`;
      if ((productRows[0]?.count || 0) === 0) {
        for (const product of seedProducts) {
          await sql`
            INSERT INTO products (id, name, price, image, category, unit, created_at)
            VALUES (${product.id}, ${product.name}, ${product.price}, ${product.image}, ${product.category}, ${product.unit}, ${product.createdAt});
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

export async function getAdminProfile(username?: string): Promise<AdminUser> {
  await ensureSchema();
  if (username?.trim()) {
    const { rows } = await sql`SELECT * FROM admin_users WHERE username = ${username.trim()} LIMIT 1;`;
    return mapAdminRow(rows[0]) || defaultAdmin;
  }
  const { rows } = await sql`SELECT * FROM admin_users WHERE id = 1 LIMIT 1;`;
  return mapAdminRow(rows[0]) || defaultAdmin;
}

export async function getAdminProfileByUsername(username: string): Promise<AdminUser | null> {
  await ensureSchema();
  const normalizedUsername = username.trim();
  if (!normalizedUsername) return null;
  const { rows } = await sql`SELECT * FROM admin_users WHERE username = ${normalizedUsername} LIMIT 1;`;
  return mapAdminRow(rows[0]);
}

export async function saveAdminProfile(currentUsername: string, profile: AdminUser): Promise<AdminUser> {
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
    WHERE username = ${currentUsername};
  `;
  return next;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM admin_users ORDER BY id ASC;`;
  return rows.map((row) => mapAdminRow(row)).filter(Boolean) as AdminUser[];
}

export async function createAdminUser(profile: AdminUser): Promise<AdminUser> {
  await ensureSchema();
  const existingUsers = await listAdminUsers();
  if (existingUsers.length >= 3) {
    throw new Error("Limite de 3 administradores atingido.");
  }

  const username = profile.username.trim();
  if (!username) {
    throw new Error("Informe um usuario para o administrador.");
  }

  const duplicate = existingUsers.find((item) => item.username.toLowerCase() === username.toLowerCase());
  if (duplicate) {
    throw new Error("Ja existe um administrador com esse usuario.");
  }

  const nextId = existingUsers.reduce((maxId, item) => Math.max(maxId, item.id || 0), 0) + 1;
  const next: AdminUser = {
    id: nextId,
    username,
    name: profile.name.trim() || `Administrador ${nextId}`,
    profileImage: profile.profileImage || "",
    password: profile.password?.trim() || "123456",
  };

  await sql`
    INSERT INTO admin_users (id, username, name, profile_image, password)
    VALUES (${next.id}, ${next.username}, ${next.name}, ${next.profileImage || ""}, ${next.password || "123456"});
  `;

  return next;
}

export async function deleteAdminUser(username: string): Promise<void> {
  await ensureSchema();
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    throw new Error("Administrador invalido.");
  }

  if (normalizedUsername === "admin") {
    throw new Error("O admin principal nao pode ser removido.");
  }

  await sql`DELETE FROM admin_users WHERE username = ${normalizedUsername};`;
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
    unit: (["und", "cx", "kg", "pact", "fardo"].includes(String(row.unit)) ? String(row.unit) : "und") as Product["unit"],
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function saveProducts(products: Product[]): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM products;`;
  for (const product of products) {
    await sql`
      INSERT INTO products (id, name, price, image, category, unit, created_at)
      VALUES (${product.id}, ${product.name}, ${product.price}, ${product.image}, ${product.category}, ${product.unit || "und"}, ${product.createdAt});
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
    pixProofFileName: row.pix_proof_file_name ? String(row.pix_proof_file_name) : undefined,
    pixProofDataUrl: row.pix_proof_data_url ? String(row.pix_proof_data_url) : undefined,
    pixProofUploadedAt: row.pix_proof_uploaded_at ? new Date(row.pix_proof_uploaded_at).toISOString() : undefined,
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  })) as Order[];
}

export async function saveOrders(orders: Order[]): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM orders;`;
  for (const order of orders) {
    await sql`
      INSERT INTO orders (id, items, customer_snapshot, total, status, payment_method, fulfillment_method, payment_confirmed, cashback_granted, pix_proof_file_name, pix_proof_data_url, pix_proof_uploaded_at, customer_id, created_at)
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
        ${order.pixProofFileName || null},
        ${order.pixProofDataUrl || null},
        ${order.pixProofUploadedAt || null},
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

export async function getCustomers(): Promise<CustomerAccount[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM customers ORDER BY full_name ASC;`;
  return rows.map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name),
    phone: String(row.phone),
    cpf: String(row.cpf || ""),
    password: String(row.password),
    street: row.street ? String(row.street) : undefined,
    number: row.street_number ? String(row.street_number) : undefined,
    reference: row.reference ? String(row.reference) : undefined,
    cashbackBalance: Number(row.cashback_balance || 0),
  }));
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
