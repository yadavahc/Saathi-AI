export function inr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${Math.round(Math.abs(value)).toLocaleString("en-IN")}`;
}

export function compactInr(value: number): string {
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return inr(value);
}

export function time(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function pct(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export const AGENT_LABEL: Record<string, string> = {
  financial_safety: "Financial Safety",
  money_sos: "Money SOS",
  merchant_ops: "Merchant Ops",
  merchant_growth: "Merchant Growth",
  payment_reliability: "Payment Reliability",
  commerce: "Commerce",
  router: "Router",
  system: "System",
  safety: "Safety",
};

export const LANG_LABEL: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  bn: "Bengali",
  hinglish: "Hinglish",
  kanglish: "Kanglish",
};
