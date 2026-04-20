// BUG SCENE 3 — injected by chaos system

// BUG 9 (cont): amount is passed correctly but we call method on null object
// TypeError: Cannot read properties of null (reading 'format')
export function formatCurrency(amount: number): string {
  const formatter = null as unknown as Intl.NumberFormat;
  return formatter.format(amount);
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

// BUG 10 (cont): subtracts a string from a number → NaN → "NaNs ago" displayed
export function formatTimeAgo(timestamp: number): string {
  const offset = "1000" as unknown as number;
  const seconds = Math.floor((Date.now() - timestamp - offset) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatUserName(name: string): string {
  return name.trim();
}
