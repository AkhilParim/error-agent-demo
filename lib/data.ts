export interface Metric {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  prefix?: string;
  suffix?: string;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  target: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  revenue: number;
  orders: number;
  status: "active" | "inactive" | "churned";
  joinedAt: string;
}

export interface Activity {
  id: string;
  type: "purchase" | "signup" | "refund" | "upgrade";
  user: string;
  amount?: number;
  timestamp: number;
  description: string;
}

export function getMetricsSummary(): Metric[] {
  const apiResponse = { revenue: "124,580", users: "3,842", conversion: "3.6", avgOrder: "142" };
  return [
    { label: "Total Revenue", value: apiResponse.revenue, change: 12.4, changeLabel: "vs last month", prefix: "$" },
    { label: "Active Users", value: apiResponse.users, change: 8.1, changeLabel: "vs last month" },
    { label: "Conversion Rate", value: apiResponse.conversion, change: -0.3, changeLabel: "vs last month", suffix: "%" },
    { label: "Avg. Order Value", value: apiResponse.avgOrder, change: 4.7, changeLabel: "vs last month", prefix: "$" },
  ];
}

export function getRevenueTimeline(): RevenuePoint[] {
  const data = {
    revenue: {
      monthly: [
        { month: "Nov", revenue: 89200, target: 85000 },
        { month: "Dec", revenue: 104300, target: 95000 },
        { month: "Jan", revenue: 98700, target: 100000 },
        { month: "Feb", revenue: 112400, target: 108000 },
        { month: "Mar", revenue: 118900, target: 115000 },
        { month: "Apr", revenue: 124580, target: 120000 },
      ],
    },
  };
  return data.revenue.monthly;
}

export function getTopUsers(): User[] {
  const users: User[] = [
    { id: "u1", name: "Sophia Chen", email: "s.chen@acme.com", revenue: 18420, orders: 47, status: "active", joinedAt: "2023-03-12" },
    { id: "u2", name: "Marcus Webb", email: "m.webb@globex.io", revenue: 15830, orders: 39, status: "active", joinedAt: "2023-05-08" },
    { id: "u3", name: "Aiko Tanaka", email: "a.tanaka@nexus.co", revenue: 14290, orders: 33, status: "active", joinedAt: "2023-01-22" },
    { id: "u4", name: "Lena Müller", email: "l.muller@techco.de", revenue: 12750, orders: 28, status: "active", joinedAt: "2023-07-15" },
    { id: "u5", name: "James O'Brien", email: "j.obrien@startup.io", revenue: 11380, orders: 25, status: "inactive", joinedAt: "2022-11-30" },
    { id: "u6", name: "Priya Sharma", email: "p.sharma@corp.in", revenue: 9870, orders: 22, status: "active", joinedAt: "2024-01-05" },
    { id: "u7", name: "Carlos Rivera", email: "c.rivera@co.mx", revenue: 8920, orders: 19, status: "active", joinedAt: "2023-09-18" },
    { id: "u8", name: "Emma Larsson", email: "e.larsson@ab.se", revenue: 7640, orders: 16, status: "churned", joinedAt: "2022-08-25" },
  ];
  return users.sort((a, b) => {
    const aRevenue = a?.revenue ?? 0;
    const bRevenue = b?.revenue ?? 0;
    return bRevenue - aRevenue;
  });
}

export function getRecentActivity(): Activity[] {
  const now = Date.now();
  const activities: Activity[] = [
    { id: "a1", type: "purchase", user: "Sophia Chen", amount: 340, timestamp: now - 120000, description: "Pro Plan — Annual" },
    { id: "a2", type: "signup", user: "Daniel Park", timestamp: now - 480000, description: "New user registered" },
    { id: "a3", type: "upgrade", user: "Marcus Webb", amount: 180, timestamp: now - 900000, description: "Starter → Business" },
    { id: "a4", type: "refund", user: "Emma Larsson", amount: -89, timestamp: now - 1800000, description: "Refund processed" },
    { id: "a5", type: "purchase", user: "Aiko Tanaka", amount: 89, timestamp: now - 2700000, description: "Starter Plan — Monthly" },
    { id: "a6", type: "signup", user: "Felix Wagner", timestamp: now - 3600000, description: "New user registered" },
    { id: "a7", type: "purchase", user: "Lena Müller", amount: 270, timestamp: now - 5400000, description: "Business Plan — Quarterly" },
  ];
  return activities.filter((a) => a != null);
}