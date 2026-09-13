export type PaymentMethod = "ru_card" | "foreign_card_1" | "foreign_card_2" | "telegram_stars";
export type PaymentStatus = "pending" | "paid" | "cancelled" | "failed";

export interface PaymentOperation {
  id: string;
  packageId: string;
  method: PaymentMethod;
  currency: string;
  amount: number;
  tokens: number;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPackage {
  id: "start" | "active" | "factory";
  videos: number;
  title: string;
  tokens: number;
  rubles: number;
  dollars: number;
  stars: number;
  popular?: boolean;
}

export const paymentPackages: PaymentPackage[] = [
  { id: "start", videos: 10, title: "Старт", tokens: 240, rubles: 1490, dollars: 18, stars: 1118 },
  { id: "active", videos: 25, title: "Для активных", tokens: 590, rubles: 3490, dollars: 43, stars: 2618, popular: true },
  { id: "factory", videos: 50, title: "Контент-завод", tokens: 1170, rubles: 6490, dollars: 80, stars: 4868 },
];

export const paymentMethods: { id: PaymentMethod; label: string }[] = [
  { id: "ru_card", label: "Карта РФ / СБП 💳" },
  { id: "foreign_card_1", label: "Зарубежная карта #1 🌍" },
  { id: "foreign_card_2", label: "Зарубежная карта #2 🌍" },
  { id: "telegram_stars", label: "Telegram Stars ⭐" },
];

export function paymentPackage(id: string) { return paymentPackages.find((item) => item.id === id); }
export function isPaymentMethod(value: string): value is PaymentMethod { return paymentMethods.some((item) => item.id === value); }
export function priceFor(item: PaymentPackage, method: PaymentMethod) {
  if (method === "foreign_card_2") return { amount: item.dollars, currency: "USD", label: `$${item.dollars}.00` };
  if (method === "telegram_stars") return { amount: item.stars, currency: "XTR", label: `${item.stars} ⭐` };
  return { amount: item.rubles, currency: "RUB", label: `${item.rubles.toLocaleString("ru-RU")} ₽` };
}
