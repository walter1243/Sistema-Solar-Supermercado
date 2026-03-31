export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  createdAt: string;
};

export type CustomerProfile = {
  fullName: string;
  cpf: string;
  phone: string;
  address: string;
};

export type CartItem = {
  productId: string;
  quantity: number;
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
  status: "novo" | "em_preparo" | "em_rota" | "entregue";
  paymentMethod: "pix";
  createdAt: string;
};

export type AdminSettings = {
  pixKey: string;
};

export type DashboardSummary = {
  revenueToday: number;
  ordersToday: number;
  productsToday: number;
  totalProducts: number;
};
