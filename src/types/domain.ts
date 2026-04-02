export type ProductUnit = "und" | "cx" | "kg" | "pact" | "fardo";

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  unit: ProductUnit;
  createdAt: string;
};

export type CustomerProfile = {
  fullName: string;
  cpf: string;
  phone: string;
  address: string;
  street?: string;
  number?: string;
  reference?: string;
};

export type CartItem = {
  productId: string;
  quantity: number;
  meatCut?: string; // "Bife" | "Inteiro" | "Moído" — apenas para produtos de carne
};

export type Order = {
  id: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  customer: CustomerProfile;
  total: number;
  status: "novo" | "separando" | "separado" | "em_rota" | "entregue" | "retirada_disponivel";
  paymentMethod: "pix" | "cartao" | "dinheiro";
  fulfillmentMethod: "entrega" | "retirada";
  paymentConfirmed?: boolean;
  cashbackGranted?: boolean;
  pixProofFileName?: string;
  pixProofDataUrl?: string;
  pixProofUploadedAt?: string;
  customerId?: string;
  createdAt: string;
};

export type AdminSettings = {
  pixKey: string;
  whatsappNumber: string;
  categories: string[];
  promotionProductIds: string[];
  deliveryMinimum: number;
  pickupMinimum: number;
  cashbackSpendThreshold: number;
  cashbackRewardValue: number;
};

export type AdminUser = {
  id?: number;
  username: string;
  name: string;
  profileImage?: string;
  password?: string;
};

export type CustomerAlert = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
};

export type CustomerAccount = {
  id: string;
  fullName: string;
  phone: string;
  cpf: string;
  password: string;
  street?: string;
  number?: string;
  reference?: string;
  cashbackBalance: number;
  alerts?: CustomerAlert[];
};

export type DashboardSummary = {
  revenueToday: number;
  ordersToday: number;
  productsToday: number;
  totalProducts: number;
};
