export type MenuItem = {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  emoji: string;
  imageUrl: string | null;
  isVeg: boolean;
  tags: string[];
  available: boolean;
};
export type MenuCategory = { id: string; name: string; emoji: string; items: MenuItem[] };
export type MenuResponse = {
  cafe: { name: string; tagline: string; pureVeg: boolean; gstRateBp: number; acceptingOrders: boolean };
  categories: MenuCategory[];
};

export type OrderStatus = "PLACED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
export type CustomerOrder = {
  id: string;
  orderNo: number;
  status: OrderStatus;
  notes: string | null;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  createdAt: string;
  preparingAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  cancelledAt?: string | null;
  items: { id: string; name: string; qty: number; unitPricePaise: number; lineTotalPaise: number }[];
  /** server estimate for orders still in the kitchen */
  estimate: null | { readyBy: string; ordersAhead: number; typicalMinutes: number };
};
export type RequestType = "WAITER" | "WATER" | "CLEAN" | "BILL" | "CUSTOM";
export type TableResponse = {
  serverTime: string;
  kitchen: { avgPrepMinutes: number };
  table: { id: number; number: number; label: string | null };
  cafe: {
    name: string; tagline: string; address: string; phone: string; gstin: string; pureVeg: boolean;
    gstRateBp: number; wifiSsid: string; wifiPassword: string; upiId: string; acceptingOrders: boolean;
  };
  bill: null | {
    id: string; billNo: number; subtotalPaise: number; taxPaise: number; totalPaise: number; openedAt: string;
    orders: CustomerOrder[];
  };
  requests: { id: string; type: RequestType; message: string; createdAt: string }[];
  lastClosedBill: null | { id: string; billNo: number; totalPaise: number; paymentMethod: string | null; closedAt: string };
};

export type Cart = Record<string, number>;
