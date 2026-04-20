import { sql } from "@vercel/postgres";
import { AdminSettings, AdminUser, Cashier, CustomerAccount, CustomerAlert, Order, Product, ReceivableAccount } from "@/types/domain";

const defaultSettings: AdminSettings = {
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

function normalizeAdminUsername(value: string) {
  return value.trim().toLowerCase();
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
          promotion_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
          promotion_start_date TEXT NOT NULL DEFAULT '',
          promotion_end_date TEXT NOT NULL DEFAULT '',
          promotion_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
          delivery_minimum NUMERIC NOT NULL DEFAULT 150,
          pickup_minimum NUMERIC NOT NULL DEFAULT 100,
          cashback_spend_threshold NUMERIC NOT NULL DEFAULT 0,
          cashback_reward_value NUMERIC NOT NULL DEFAULT 0,
          card_debit_fee_percent NUMERIC NOT NULL DEFAULT 3,
          card_credit_fee_percent NUMERIC NOT NULL DEFAULT 5
        );
      `;

      await sql`
        ALTER TABLE admin_settings
        ADD COLUMN IF NOT EXISTS promotion_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
      `;

      await sql`
        ALTER TABLE admin_settings
        ADD COLUMN IF NOT EXISTS promotion_start_date TEXT NOT NULL DEFAULT '';
      `;

      await sql`
        ALTER TABLE admin_settings
        ADD COLUMN IF NOT EXISTS promotion_end_date TEXT NOT NULL DEFAULT '';
      `;

      await sql`
        ALTER TABLE admin_settings
        ADD COLUMN IF NOT EXISTS promotion_prices JSONB NOT NULL DEFAULT '{}'::jsonb;
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
        ALTER TABLE admin_settings
        ADD COLUMN IF NOT EXISTS card_debit_fee_percent NUMERIC NOT NULL DEFAULT 3;
      `;

      await sql`
        ALTER TABLE admin_settings
        ADD COLUMN IF NOT EXISTS card_credit_fee_percent NUMERIC NOT NULL DEFAULT 5;
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
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
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
        CREATE TABLE IF NOT EXISTS cashiers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS receivable_accounts (
          id TEXT PRIMARY KEY,
          invoice_total NUMERIC NOT NULL,
          payer_type TEXT NOT NULL,
          payer_name TEXT NOT NULL,
          holder_name TEXT,
          duplicate_number TEXT NOT NULL,
          payment_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          paid_amount NUMERIC NOT NULL,
          remaining_amount NUMERIC NOT NULL,
          change_amount NUMERIC NOT NULL,
          payment_method TEXT NOT NULL,
          cashier_id TEXT NOT NULL,
          cashier_name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;

      await sql`
        ALTER TABLE receivable_accounts
        ADD COLUMN IF NOT EXISTS payment_date TEXT;
      `;

      await sql`
        UPDATE receivable_accounts
        SET payment_date = TO_CHAR(created_at::date, 'YYYY-MM-DD')
        WHERE payment_date IS NULL OR TRIM(payment_date) = '';
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
          promotion_product_ids,
          promotion_start_date,
          promotion_end_date,
          promotion_prices,
          delivery_minimum,
          pickup_minimum,
          cashback_spend_threshold,
          cashback_reward_value,
          card_debit_fee_percent,
          card_credit_fee_percent
        )
        VALUES (
          1,
          ${defaultSettings.pixKey},
          ${defaultSettings.whatsappNumber},
          ${JSON.stringify(defaultSettings.categories)}::jsonb,
          ${JSON.stringify(defaultSettings.promotionProductIds)}::jsonb,
          ${defaultSettings.promotionStartDate},
          ${defaultSettings.promotionEndDate},
          ${JSON.stringify(defaultSettings.promotionPrices)}::jsonb,
          ${defaultSettings.deliveryMinimum},
          ${defaultSettings.pickupMinimum},
          ${defaultSettings.cashbackSpendThreshold},
          ${defaultSettings.cashbackRewardValue},
          ${defaultSettings.cardDebitFeePercent},
          ${defaultSettings.cardCreditFeePercent}
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
    promotionProductIds: Array.isArray(data.promotion_product_ids) ? data.promotion_product_ids : defaultSettings.promotionProductIds,
    promotionStartDate: String(data.promotion_start_date || ""),
    promotionEndDate: String(data.promotion_end_date || ""),
    promotionPrices: data.promotion_prices && typeof data.promotion_prices === "object" ? (data.promotion_prices as Record<string, number>) : defaultSettings.promotionPrices,
    deliveryMinimum: Number(data.delivery_minimum || defaultSettings.deliveryMinimum),
    pickupMinimum: Number(data.pickup_minimum || defaultSettings.pickupMinimum),
    cashbackSpendThreshold: Number(data.cashback_spend_threshold || defaultSettings.cashbackSpendThreshold),
    cashbackRewardValue: Number(data.cashback_reward_value || defaultSettings.cashbackRewardValue),
    cardDebitFeePercent: Number(data.card_debit_fee_percent ?? defaultSettings.cardDebitFeePercent),
    cardCreditFeePercent: Number(data.card_credit_fee_percent ?? defaultSettings.cardCreditFeePercent),
  };
}

export async function saveSettings(settings: AdminSettings): Promise<AdminSettings> {
  await ensureSchema();
  const next: AdminSettings = {
    ...defaultSettings,
    ...settings,
    categories: settings.categories?.length ? settings.categories : defaultSettings.categories,
    promotionProductIds: Array.isArray(settings.promotionProductIds) ? settings.promotionProductIds : defaultSettings.promotionProductIds,
    promotionStartDate: typeof settings.promotionStartDate === "string" ? settings.promotionStartDate : defaultSettings.promotionStartDate,
    promotionEndDate: typeof settings.promotionEndDate === "string" ? settings.promotionEndDate : defaultSettings.promotionEndDate,
    promotionPrices: settings.promotionPrices && typeof settings.promotionPrices === "object" ? settings.promotionPrices : defaultSettings.promotionPrices,
    deliveryMinimum: Number.isFinite(settings.deliveryMinimum) ? Number(settings.deliveryMinimum) : defaultSettings.deliveryMinimum,
    pickupMinimum: Number.isFinite(settings.pickupMinimum) ? Number(settings.pickupMinimum) : defaultSettings.pickupMinimum,
    cashbackSpendThreshold: Number.isFinite(settings.cashbackSpendThreshold) ? Number(settings.cashbackSpendThreshold) : defaultSettings.cashbackSpendThreshold,
    cashbackRewardValue: Number.isFinite(settings.cashbackRewardValue) ? Number(settings.cashbackRewardValue) : defaultSettings.cashbackRewardValue,
    cardDebitFeePercent: Number.isFinite(settings.cardDebitFeePercent) ? Number(settings.cardDebitFeePercent) : defaultSettings.cardDebitFeePercent,
    cardCreditFeePercent: Number.isFinite(settings.cardCreditFeePercent) ? Number(settings.cardCreditFeePercent) : defaultSettings.cardCreditFeePercent,
  };
  await sql`
    UPDATE admin_settings
    SET pix_key = ${next.pixKey},
        whatsapp_number = ${next.whatsappNumber},
        categories = ${JSON.stringify(next.categories)}::jsonb,
        promotion_product_ids = ${JSON.stringify(next.promotionProductIds)}::jsonb,
        promotion_start_date = ${next.promotionStartDate},
        promotion_end_date = ${next.promotionEndDate},
        promotion_prices = ${JSON.stringify(next.promotionPrices)}::jsonb,
        delivery_minimum = ${next.deliveryMinimum},
        pickup_minimum = ${next.pickupMinimum},
        cashback_spend_threshold = ${next.cashbackSpendThreshold},
        cashback_reward_value = ${next.cashbackRewardValue},
        card_debit_fee_percent = ${next.cardDebitFeePercent},
        card_credit_fee_percent = ${next.cardCreditFeePercent}
    WHERE id = 1;
  `;
  return next;
}

export async function getAdminProfile(username?: string): Promise<AdminUser> {
  await ensureSchema();
  if (username?.trim()) {
    const normalizedUsername = normalizeAdminUsername(username);
    const { rows } = await sql`SELECT * FROM admin_users WHERE lower(username) = ${normalizedUsername} LIMIT 1;`;
    return mapAdminRow(rows[0]) || defaultAdmin;
  }
  const { rows } = await sql`SELECT * FROM admin_users WHERE id = 1 LIMIT 1;`;
  return mapAdminRow(rows[0]) || defaultAdmin;
}

export async function getAdminProfileByUsername(username: string): Promise<AdminUser | null> {
  await ensureSchema();
  const normalizedUsername = normalizeAdminUsername(username);
  if (!normalizedUsername) return null;
  const { rows } = await sql`SELECT * FROM admin_users WHERE lower(username) = ${normalizedUsername} LIMIT 1;`;
  return mapAdminRow(rows[0]);
}

export async function saveAdminProfile(currentUsername: string, profile: AdminUser): Promise<AdminUser> {
  await ensureSchema();
  const normalizedCurrentUsername = normalizeAdminUsername(currentUsername);
  if (!normalizedCurrentUsername) {
    throw new Error("Administrador invalido.");
  }

  const normalizedUsername = normalizeAdminUsername(profile.username || "");
  if (!normalizedUsername) {
    throw new Error("Informe um usuario valido.");
  }

  const name = profile.name.trim();
  if (!name) {
    throw new Error("Informe um nome valido.");
  }

  const password = (profile.password || "").trim() || "123456";

  const { rows: duplicateRows } = await sql`
    SELECT username
    FROM admin_users
    WHERE lower(username) = ${normalizedUsername}
      AND lower(username) <> ${normalizedCurrentUsername}
    LIMIT 1;
  `;

  if (duplicateRows.length > 0) {
    throw new Error("Ja existe um administrador com esse usuario.");
  }

  const next = {
    ...defaultAdmin,
    ...profile,
    username: normalizedUsername,
    name,
    password,
  };

  const updateResult = await sql`
    UPDATE admin_users
    SET username = ${next.username},
        name = ${next.name},
        profile_image = ${next.profileImage || ""},
        password = ${next.password || "123456"}
    WHERE lower(username) = ${normalizedCurrentUsername};
  `;

  if ((updateResult.rowCount || 0) === 0) {
    throw new Error("Administrador nao encontrado para atualizacao.");
  }

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

  const username = normalizeAdminUsername(profile.username || "");
  if (!username) {
    throw new Error("Informe um usuario para o administrador.");
  }

  const duplicate = existingUsers.find((item) => item.username.toLowerCase() === username);
  if (duplicate) {
    throw new Error("Ja existe um administrador com esse usuario.");
  }

  const nextId = existingUsers.reduce((maxId, item) => Math.max(maxId, item.id || 0), 0) + 1;
  const name = profile.name.trim() || `Administrador ${nextId}`;
  const password = profile.password?.trim() || "123456";

  const next: AdminUser = {
    id: nextId,
    username,
    name,
    profileImage: profile.profileImage || "",
    password,
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
    createdAt: (() => {
      const parsed = new Date(String(row.created_at || ""));
      return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    })(),
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

export async function listCashiers(): Promise<Cashier[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM cashiers ORDER BY created_at ASC;`;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function createCashier(name: string): Promise<Cashier> {
  await ensureSchema();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Informe o nome do caixa.");
  }

  const { rows: duplicateRows } = await sql`
    SELECT id
    FROM cashiers
    WHERE lower(name) = lower(${trimmed})
    LIMIT 1;
  `;

  if (duplicateRows.length > 0) {
    throw new Error("Ja existe um caixa com esse nome.");
  }

  const next: Cashier = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO cashiers (id, name, created_at)
    VALUES (${next.id}, ${next.name}, ${next.createdAt});
  `;

  return next;
}

export async function deleteCashier(cashierId: string): Promise<void> {
  await ensureSchema();
  const id = cashierId.trim();
  if (!id) {
    throw new Error("Caixa invalido.");
  }

  await sql`
    DELETE FROM cashiers
    WHERE id = ${id};
  `;
}

export async function listReceivableAccounts(): Promise<ReceivableAccount[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT *
    FROM receivable_accounts
    ORDER BY COALESCE(NULLIF(payment_date, ''), TO_CHAR(created_at::date, 'YYYY-MM-DD')) DESC, created_at DESC;
  `;
  return rows.map((row) => ({
    id: String(row.id),
    invoiceTotal: Number(row.invoice_total),
    payerType: row.payer_type === "fiador" ? "fiador" : "titular",
    payerName: String(row.payer_name),
    holderName: row.holder_name ? String(row.holder_name) : undefined,
    duplicateNumber: String(row.duplicate_number),
    paymentDate: String(row.payment_date || new Date(row.created_at).toISOString().slice(0, 10)),
    dueDate: String(row.due_date),
    paidAmount: Number(row.paid_amount),
    remainingAmount: Number(row.remaining_amount),
    changeAmount: Number(row.change_amount),
    paymentMethod: String(row.payment_method),
    cashierId: String(row.cashier_id),
    cashierName: String(row.cashier_name),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function createReceivableAccount(account: Omit<ReceivableAccount, "id" | "createdAt">): Promise<ReceivableAccount> {
  await ensureSchema();

  const invoiceTotal = Number(account.invoiceTotal || 0);
  const paidAmount = Number(account.paidAmount || 0);
  const remainingAmount = Number(account.remainingAmount || 0);
  const changeAmount = Number(account.changeAmount || 0);
  const duplicateNumber = (account.duplicateNumber || "").trim();
  const paymentDate = (account.paymentDate || "").trim();
  const payerName = (account.payerName || "").trim();
  const holderName = (account.holderName || "").trim();
  const paymentMethod = (account.paymentMethod || "").trim();
  const dueDate = (account.dueDate || "").trim();
  const cashierId = (account.cashierId || "").trim();
  const cashierName = (account.cashierName || "").trim();

  if (!Number.isFinite(invoiceTotal) || invoiceTotal <= 0) throw new Error("Valor total da nota invalido.");
  if (!payerName) throw new Error("Informe o nome da pessoa.");
  if (!duplicateNumber) throw new Error("Informe o numero da duplicata.");
  if (!paymentDate) throw new Error("Informe a data de recebimento.");
  if (!dueDate) throw new Error("Informe a data de vencimento.");
  if (!Number.isFinite(paidAmount) || paidAmount < 0) throw new Error("Valor pago invalido.");
  if (!Number.isFinite(remainingAmount) || remainingAmount < 0) throw new Error("Valor restante invalido.");
  if (!Number.isFinite(changeAmount) || changeAmount < 0) throw new Error("Troco invalido.");
  if (!paymentMethod) throw new Error("Informe a forma de pagamento.");
  if (!cashierId || !cashierName) throw new Error("Selecione um caixa.");

  const next: ReceivableAccount = {
    id: crypto.randomUUID(),
    invoiceTotal,
    payerType: account.payerType === "fiador" ? "fiador" : "titular",
    payerName,
    holderName: holderName || undefined,
    duplicateNumber,
    paymentDate,
    dueDate,
    paidAmount,
    remainingAmount,
    changeAmount,
    paymentMethod,
    cashierId,
    cashierName,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO receivable_accounts (
      id,
      invoice_total,
      payer_type,
      payer_name,
      holder_name,
      duplicate_number,
      payment_date,
      due_date,
      paid_amount,
      remaining_amount,
      change_amount,
      payment_method,
      cashier_id,
      cashier_name,
      created_at
    )
    VALUES (
      ${next.id},
      ${next.invoiceTotal},
      ${next.payerType},
      ${next.payerName},
      ${next.holderName || null},
      ${next.duplicateNumber},
      ${next.paymentDate},
      ${next.dueDate},
      ${next.paidAmount},
      ${next.remainingAmount},
      ${next.changeAmount},
      ${next.paymentMethod},
      ${next.cashierId},
      ${next.cashierName},
      ${next.createdAt}
    );
  `;

  return next;
}

export async function updateReceivableAccount(id: string, account: Omit<ReceivableAccount, "id" | "createdAt">): Promise<ReceivableAccount> {
  await ensureSchema();

  const invoiceTotal = Number(account.invoiceTotal || 0);
  const paidAmount = Number(account.paidAmount || 0);
  const remainingAmount = Number(account.remainingAmount || 0);
  const changeAmount = Number(account.changeAmount || 0);
  const duplicateNumber = (account.duplicateNumber || "").trim();
  const paymentDate = (account.paymentDate || "").trim();
  const payerName = (account.payerName || "").trim();
  const holderName = (account.holderName || "").trim();
  const paymentMethod = (account.paymentMethod || "").trim();
  const dueDate = (account.dueDate || "").trim();
  const cashierId = (account.cashierId || "").trim();
  const cashierName = (account.cashierName || "").trim();

  if (!Number.isFinite(invoiceTotal) || invoiceTotal <= 0) throw new Error("Valor total da nota invalido.");
  if (!payerName) throw new Error("Informe o nome da pessoa.");
  if (!duplicateNumber) throw new Error("Informe o numero da duplicata.");
  if (!paymentDate) throw new Error("Informe a data de recebimento.");
  if (!dueDate) throw new Error("Informe a data de vencimento.");
  if (!Number.isFinite(paidAmount) || paidAmount < 0) throw new Error("Valor pago invalido.");
  if (!Number.isFinite(remainingAmount) || remainingAmount < 0) throw new Error("Valor restante invalido.");
  if (!Number.isFinite(changeAmount) || changeAmount < 0) throw new Error("Troco invalido.");
  if (!paymentMethod) throw new Error("Informe a forma de pagamento.");
  if (!cashierId || !cashierName) throw new Error("Selecione um caixa.");

  await sql`
    UPDATE receivable_accounts
    SET
      invoice_total = ${invoiceTotal},
      payer_type = ${account.payerType === "fiador" ? "fiador" : "titular"},
      payer_name = ${payerName},
      holder_name = ${holderName || null},
      duplicate_number = ${duplicateNumber},
      payment_date = ${paymentDate},
      due_date = ${dueDate},
      paid_amount = ${paidAmount},
      remaining_amount = ${remainingAmount},
      change_amount = ${changeAmount},
      payment_method = ${paymentMethod},
      cashier_id = ${cashierId},
      cashier_name = ${cashierName}
    WHERE id = ${id};
  `;

  const { rows } = await sql`SELECT * FROM receivable_accounts WHERE id = ${id};`;
  if (rows.length === 0) throw new Error("Conta recebida nao encontrada.");

  const row = rows[0]!;
  return {
    id: String(row.id),
    invoiceTotal: Number(row.invoice_total),
    payerType: row.payer_type === "fiador" ? "fiador" : "titular",
    payerName: String(row.payer_name),
    holderName: row.holder_name ? String(row.holder_name) : undefined,
    duplicateNumber: String(row.duplicate_number),
    paymentDate: String(row.payment_date || new Date(row.created_at).toISOString().slice(0, 10)),
    dueDate: String(row.due_date),
    paidAmount: Number(row.paid_amount),
    remainingAmount: Number(row.remaining_amount),
    changeAmount: Number(row.change_amount),
    paymentMethod: String(row.payment_method),
    cashierId: String(row.cashier_id),
    cashierName: String(row.cashier_name),
    createdAt: new Date(row.created_at).toISOString(),
  };
}
