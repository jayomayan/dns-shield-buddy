// Mock data for the DNS Filtering System

export const queryStats = {
  totalQueries: 847293,
  blockedQueries: 124856,
  allowedQueries: 722437,
  cachedQueries: 312045,
  avgResponseTime: 12.4,
  uptime: 99.97,
};

export const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, "0")}:00`,
  allowed: Math.floor(Math.random() * 5000 + 2000),
  blocked: Math.floor(Math.random() * 1500 + 300),
  cached: Math.floor(Math.random() * 3000 + 1000),
}));

export const topBlockedDomains = [
  { domain: "ads.doubleclick.net", count: 12453, category: "Advertising" },
  { domain: "tracker.analytics.io", count: 8921, category: "Tracking" },
  { domain: "malware-c2.evil.com", count: 4532, category: "Malware" },
  { domain: "phishing.badsite.xyz", count: 3217, category: "Phishing" },
  { domain: "crypto-miner.pool.net", count: 2891, category: "Cryptomining" },
  { domain: "spam.mailblast.org", count: 2145, category: "Spam" },
  { domain: "adserver.tracking.com", count: 1987, category: "Advertising" },
  { domain: "telemetry.snoop.io", count: 1654, category: "Tracking" },
];

export const topAllowedDomains = [
  { domain: "google.com", count: 45230, category: "Search" },
  { domain: "github.com", count: 32100, category: "Development" },
  { domain: "slack.com", count: 28900, category: "Communication" },
  { domain: "office365.com", count: 24500, category: "Productivity" },
  { domain: "aws.amazon.com", count: 19800, category: "Cloud" },
];

export const queryLogs = Array.from({ length: 100 }, (_, i) => ({
  id: `log-${i}`,
  timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
  clientIp: `192.168.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 255)}`,
  domain: [
    "google.com", "ads.doubleclick.net", "github.com", "tracker.analytics.io",
    "slack.com", "malware-c2.evil.com", "office365.com", "phishing.badsite.xyz",
    "aws.amazon.com", "cdn.jsdelivr.net", "api.stripe.com", "fonts.googleapis.com",
  ][Math.floor(Math.random() * 12)],
  type: ["A", "AAAA", "CNAME", "MX", "TXT"][Math.floor(Math.random() * 5)],
  status: Math.random() > 0.2 ? "allowed" : "blocked",
  responseTime: Math.floor(Math.random() * 50 + 1),
  tenant: ["Acme Corp", "Globex Inc", "Initech", "Umbrella Co"][Math.floor(Math.random() * 4)],
})).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

export type QueryLog = (typeof queryLogs)[0];

export const whitelistRules = [
  { id: "w1", domain: "*.google.com", tenant: "Global", createdAt: "2024-01-15", enabled: true },
  { id: "w2", domain: "*.github.com", tenant: "Global", createdAt: "2024-01-15", enabled: true },
  { id: "w3", domain: "*.slack.com", tenant: "Acme Corp", createdAt: "2024-02-01", enabled: true },
  { id: "w4", domain: "*.office365.com", tenant: "Global", createdAt: "2024-01-15", enabled: true },
  { id: "w5", domain: "*.amazonaws.com", tenant: "Global", createdAt: "2024-01-20", enabled: true },
];

export const blacklistRules = [
  { id: "b1", domain: "*.doubleclick.net", category: "Advertising", tenant: "Global", createdAt: "2024-01-15", enabled: true },
  { id: "b2", domain: "*.analytics.io", category: "Tracking", tenant: "Global", createdAt: "2024-01-15", enabled: true },
  { id: "b3", domain: "malware-c2.evil.com", category: "Malware", tenant: "Global", createdAt: "2024-03-01", enabled: true },
  { id: "b4", domain: "*.badsite.xyz", category: "Phishing", tenant: "Global", createdAt: "2024-02-10", enabled: true },
  { id: "b5", domain: "*.crypto-miner.pool.net", category: "Cryptomining", tenant: "Global", createdAt: "2024-01-25", enabled: false },
  { id: "b6", domain: "*.mailblast.org", category: "Spam", tenant: "Initech", createdAt: "2024-03-05", enabled: true },
];

export const serverMetrics = {
  cpu: 23,
  memory: 45,
  disk: 62,
  networkIn: 125.4,
  networkOut: 89.2,
  dnsPort: 53,
  apiPort: 443,
  status: "running" as const,
  version: "2.4.1",
  os: "Ubuntu 22.04 LTS",
  resolver: "Unbound 1.19.0",
};

export const tenants = [
  { id: "t1", name: "Acme Corp", users: 245, queries: 312450, blocked: 45600 },
  { id: "t2", name: "Globex Inc", users: 128, queries: 198200, blocked: 32100 },
  { id: "t3", name: "Initech", users: 89, queries: 156300, blocked: 21400 },
  { id: "t4", name: "Umbrella Co", users: 312, queries: 180343, blocked: 25756 },
];
