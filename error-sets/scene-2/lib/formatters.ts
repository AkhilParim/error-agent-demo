// BUG SCENE 2 — injected by chaos system

// BUG 7: Multiplies amount (number) by the string "1.0" → NaN → "$NaN" displayed
export function formatCurrency(amount: number): string {
  const factor = "1.0" as unknown as number;
  return "$" + (amount * factor).toFixed(0);
}

export function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercentage(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// BUG 8: new Date(undefined) → "Invalid Date" shown everywhere dates appear
export function formatDate(isoString: string): string {
  return new Date(undefined as unknown as string).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatUserName(name: string): string {
  return name.trim();
}
