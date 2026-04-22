export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0";
  return "$" + amount.toFixed(0);
}

export function formatCurrencyFull(amount: number | null | undefined): string {
  if (amount == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null) return "0.0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
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

export function formatUserName(name: string | null | undefined): string {
  if (name == null) return "";
  return name.trim();
}