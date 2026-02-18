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
  type: ["A", "AAAA", "CNAME", "MX", "TXT"][Math.floor(Math.random() * 5)] as "A" | "AAAA" | "CNAME" | "MX" | "TXT",
  status: (Math.random() > 0.2 ? "allowed" : "blocked") as "allowed" | "blocked",
  responseTime: Math.floor(Math.random() * 50 + 1),
})).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

export type QueryLog = (typeof queryLogs)[0];

export const whitelistRules = [
  { id: "w1", domain: "*.google.com", createdAt: "2024-01-15", enabled: true },
  { id: "w2", domain: "*.github.com", createdAt: "2024-01-15", enabled: true },
  { id: "w3", domain: "*.slack.com", createdAt: "2024-02-01", enabled: true },
  { id: "w4", domain: "*.office365.com", createdAt: "2024-01-15", enabled: true },
  { id: "w5", domain: "*.amazonaws.com", createdAt: "2024-01-20", enabled: true },
];

export const blacklistRules = [
  { id: "b1", domain: "*.doubleclick.net", category: "Advertising", createdAt: "2024-01-15", enabled: true },
  { id: "b2", domain: "*.analytics.io", category: "Tracking", createdAt: "2024-01-15", enabled: true },
  { id: "b3", domain: "malware-c2.evil.com", category: "Malware", createdAt: "2024-03-01", enabled: true },
  { id: "b4", domain: "*.badsite.xyz", category: "Phishing", createdAt: "2024-02-10", enabled: true },
  { id: "b5", domain: "*.crypto-miner.pool.net", category: "Cryptomining", createdAt: "2024-01-25", enabled: false },
  { id: "b6", domain: "*.mailblast.org", category: "Spam", createdAt: "2024-03-05", enabled: true },
];

export interface CategoryBlacklist {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  domains: string[];
}

export const categoryBlacklists: CategoryBlacklist[] = [
  {
    id: "cat-social",
    name: "Social Media",
    description: "Block social media platforms and related services",
    enabled: false,
    domains: [
      "*.facebook.com", "*.instagram.com", "*.twitter.com", "*.x.com", "*.tiktok.com",
      "*.snapchat.com", "*.pinterest.com", "*.linkedin.com", "*.reddit.com", "*.tumblr.com",
      "*.threads.net", "*.mastodon.social",
    ],
  },
  {
    id: "cat-gaming",
    name: "Gaming",
    description: "Block gaming platforms, stores, and multiplayer services",
    enabled: false,
    domains: [
      "*.steampowered.com", "*.store.steampowered.com", "*.epicgames.com", "*.ea.com",
      "*.riotgames.com", "*.blizzard.com", "*.battle.net", "*.xbox.com", "*.playstation.com",
      "*.twitch.tv", "*.discord.gg", "*.roblox.com", "*.minecraft.net",
    ],
  },
  {
    id: "cat-streaming",
    name: "Streaming & Video",
    description: "Block video streaming and entertainment platforms",
    enabled: false,
    domains: [
      "*.youtube.com", "*.netflix.com", "*.hulu.com", "*.disneyplus.com", "*.hbomax.com",
      "*.primevideo.com", "*.peacocktv.com", "*.crunchyroll.com", "*.twitch.tv",
      "*.dailymotion.com", "*.vimeo.com",
    ],
  },
  {
    id: "cat-shopping",
    name: "Shopping",
    description: "Block e-commerce and online shopping sites",
    enabled: false,
    domains: [
      "*.amazon.com", "*.ebay.com", "*.etsy.com", "*.walmart.com", "*.target.com",
      "*.aliexpress.com", "*.wish.com", "*.shopify.com", "*.bestbuy.com",
    ],
  },
  {
    id: "cat-malware",
    name: "Malware & Phishing",
    description: "Block known malware distribution and phishing domains",
    enabled: true,
    domains: [
      "*.malware-c2.evil.com", "*.phishing.badsite.xyz", "*.ransomware.pay.net",
      "*.keylogger.stealth.io", "*.trojan.download.xyz", "*.exploit-kit.bad.com",
      "*.fake-bank-login.com", "*.credential-harvest.net", "*.drive-by-download.org",
      "*.botnet-controller.xyz",
    ],
  },
  {
    id: "cat-ads",
    name: "Advertising & Tracking",
    description: "Block ad networks, trackers, and analytics beacons",
    enabled: true,
    domains: [
      "*.doubleclick.net", "*.googlesyndication.com", "*.adnxs.com", "*.taboola.com",
      "*.outbrain.com", "*.criteo.com", "*.facebook.net", "*.hotjar.com",
      "*.mixpanel.com", "*.segment.io", "*.amplitude.com", "*.mouseflow.com",
    ],
  },
  {
    id: "cat-adult",
    name: "Adult Content",
    description: "Block adult and explicit content websites",
    enabled: true,
    domains: ["*.pornhub.com", "*.xvideos.com", "*.xhamster.com", "*.onlyfans.com", "*.redtube.com"],
  },
  {
    id: "cat-gambling",
    name: "Gambling",
    description: "Block online gambling and betting platforms",
    enabled: false,
    domains: [
      "*.bet365.com", "*.draftkings.com", "*.fanduel.com", "*.pokerstars.com",
      "*.888casino.com", "*.bovada.lv", "*.betway.com",
    ],
  },
  {
    id: "cat-spam",
    name: "Spam",
    description: "Block known spam sources and bulk email services",
    enabled: true,
    domains: [
      "*.mailblast.org", "*.spam-sender.net", "*.bulk-mailer.io",
      "*.fake-newsletter.com", "*.junk-mail-server.org",
    ],
  },
  {
    id: "cat-crypto",
    name: "Cryptomining",
    description: "Block browser-based cryptocurrency mining scripts",
    enabled: true,
    domains: [
      "*.coinhive.com", "*.crypto-loot.com", "*.coin-hive.com",
      "*.jsecoin.com", "*.cryptonight.wasm", "*.minero.cc",
    ],
  },
];

export const serverMetrics: {
  cpu: number; memory: number; disk: number; networkIn: number; networkOut: number;
  dnsPort: number; apiPort: number; status: "running" | "stopped" | "unknown";
  version: string; os: string; resolver: string; hostname: string;
  ipAddress: string; publicIp: string; netmask: string; gateway: string;
  macAddress: string; dnsInterface: string;
} = {
  cpu: 23,
  memory: 45,
  disk: 62,
  networkIn: 125.4,
  networkOut: 89.2,
  dnsPort: 53,
  apiPort: 443,
  status: "running",
  version: "2.4.1",
  os: "Ubuntu 22.04 LTS",
  resolver: "Unbound 1.19.0",
  hostname: "dns-shield-01",
  ipAddress: "192.168.1.10",
  publicIp: "203.0.113.42",
  netmask: "255.255.255.0",
  gateway: "192.168.1.1",
  macAddress: "00:1A:2B:3C:4D:5E",
  dnsInterface: "eth0",
};
