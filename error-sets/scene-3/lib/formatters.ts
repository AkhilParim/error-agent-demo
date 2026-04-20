// BUG SCENE 3 — injected by chaos system
// Errors: Invalid Date from undefined input, null pointer in formatUserName

// BUG 8: new Date(undefined) produces "Invalid Date"
// .toLocaleDateString() on Invalid Date returns the string "Invalid Date"
// This renders visibly wrong throughout the dashboard
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

// BUG 9: Passing undefined to Date constructor produces "Invalid Date"
// The joinedAt dates in the user table all render as "Invalid Date"
export function formatDate(isoString: string): string {
  return new Date(undefined as unknown as string).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// BUG 10: user.profile is null for some users — .displayName throws TypeError
// TypeError: Cannot read properties of null (reading 'displayName')
export function formatUserName(name: string): string {
  const user = { profile: null } as unknown as { profile: { displayName: string } };
  return user.profile.displayName.trim();
}
