// Unbound Bridge Client
// Fetches real data from the local unbound-bridge HTTP server.
// The bridge URL is user-configurable and stored in localStorage.

import { getBridgeUrl } from "@/hooks/use-bridge-url";

export interface UnboundRawStats {
  [key: string]: string;
}

export interface UnboundLiveStats {
  totalQueries: number;
  allowedQueries: number;
  blockedQueries: number;
  cachedQueries: number;
  avgResponseTime: number;
  uptime: number;
  cacheHits: number;
  cacheMiss: number;
  prefetch: number;
  recursionAvg: number;
  queryTypes: Record<string, number>;
  returnCodes: Record<string, number>;
}

export interface BridgeSystemInfo {
  status: "running" | "stopped" | "unknown";
  hostname: string;
  version: string;
  resolver: string;
  os: string;
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
  ipAddress: string;
  publicIp: string;
  netmask: string;
  gateway: string;
  macAddress: string;
  dnsInterface: string;
  dnsPort: number;
  apiPort: number;
}

export interface BridgeLogEntry {
  id: string;
  timestamp: string;
  clientIp: string;
  domain: string;
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "PTR" | "SRV" | "NS";
  status: "allowed" | "blocked";
  responseTime: number;
}

function parseFloat2(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val) || 0;
}

function parseInt2(val: string | undefined): number {
  if (!val) return 0;
  return parseInt(val, 10) || 0;
}

/**
 * Parse unbound-control stats output (key=value lines turned into JSON by bridge).
 */
export function parseUnboundStats(raw: UnboundRawStats): UnboundLiveStats {
  const total = parseInt2(raw["total.num.queries"]);
  const cacheHits = parseInt2(raw["total.num.cachehits"]);
  const cacheMiss = parseInt2(raw["total.num.cachemiss"]);
  const prefetch = parseInt2(raw["total.num.prefetch"]);
  const recursionAvg = parseFloat2(raw["total.recursion.time.avg"]);
  const uptime = parseFloat2(raw["time.elapsed"]);

  const queryTypes: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    const m = key.match(/^num\.query\.type\.(.+)$/);
    if (m) queryTypes[m[1]] = parseInt2(val);
  }

  const returnCodes: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    const m = key.match(/^num\.answer\.rcode\.(.+)$/);
    if (m) returnCodes[m[1]] = parseInt2(val);
  }

  const blockedQueries = parseInt2(raw["num.answer.rcode.REFUSED"]);
  const allowedQueries = Math.max(0, total - blockedQueries);

  return {
    totalQueries: total,
    allowedQueries,
    blockedQueries,
    cachedQueries: cacheHits,
    avgResponseTime: parseFloat((recursionAvg * 1000).toFixed(1)),
    uptime: parseFloat((uptime / 3600).toFixed(2)),
    cacheHits,
    cacheMiss,
    prefetch,
    recursionAvg,
    queryTypes,
    returnCodes,
  };
}

function baseUrl() {
  return getBridgeUrl();
}

/** Fetch live stats from the bridge (GET /stats). */
export async function fetchUnboundStats(): Promise<UnboundLiveStats> {
  const res = await fetch(`${baseUrl()}/stats`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Bridge /stats returned ${res.status}`);
  const raw: UnboundRawStats = await res.json();
  return parseUnboundStats(raw);
}

/**
 * Fetch system/health info from the bridge (GET /info).
 * Bridge should return a JSON object matching BridgeSystemInfo.
 */
export async function fetchUnboundInfo(): Promise<Partial<BridgeSystemInfo>> {
  const res = await fetch(`${baseUrl()}/info`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Bridge /info returned ${res.status}`);
  return await res.json();
}

/**
 * Fetch recent DNS query log entries (GET /logs?limit=N).
 * Bridge tails the unbound log or uses dump_requestlist and returns an array.
 */
export async function fetchUnboundLogs(limit = 50): Promise<BridgeLogEntry[]> {
  const res = await fetch(`${baseUrl()}/logs?limit=${limit}`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Bridge /logs returned ${res.status}`);
  return await res.json();
}

export interface LogsSummary {
  hourly: { hour: string; allowed: number; blocked: number }[];
  topBlocked: { domain: string; count: number }[];
  totalAllowed: number;
  totalBlocked: number;
}

/**
 * Fetch a 24h summary derived from log file (GET /logs/summary).
 * Returns per-hour query counts and top blocked domains.
 */
export async function fetchLogsSummary(): Promise<LogsSummary> {
  const res = await fetch(`${baseUrl()}/logs/summary`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Bridge /logs/summary returned ${res.status}`);
  return await res.json();
}


export interface RulesPayload {
  blacklist: { domain: string; enabled: boolean; category: string }[];
  whitelist: { domain: string; enabled: boolean }[];
  categories: { name: string; enabled: boolean; domains: string[] }[];
}

/**
 * Push the full ruleset to the bridge (POST /rules).
 * The bridge writes local-zone entries into Unbound via unbound-control and reloads.
 */
export async function pushRules(rules: RulesPayload): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${baseUrl()}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rules),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Bridge /rules returned ${res.status}`);
  return await res.json();
}

/** Check if the bridge is reachable. */
export async function pingBridge(): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/stats`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Flush the Unbound cache via the bridge (POST /cache/flush). */
export async function flushCache(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${baseUrl()}/cache/flush`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Bridge /cache/flush returned ${res.status}`);
  return await res.json();
}

export interface PingServerResult {
  server: string;
  latency: number | null;
  status: "ok" | "timeout";
}

/** Fetch real upstream DNS latency results from the bridge (GET /ping). */
export async function fetchPingResults(): Promise<PingServerResult[]> {
  const res = await fetch(`${baseUrl()}/ping`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Bridge /ping returned ${res.status}`);
  return await res.json();
}

export interface DnsQueryResult {
  domain: string;
  type: string;
  status: "NOERROR" | "NXDOMAIN" | "REFUSED" | "SERVFAIL" | string;
  answers: { name: string; type: string; ttl: number; data: string }[];
  responseTime: number;
  server: string;
  flags: string[];
  blocked: boolean;
}

/** Run a real DNS query through the bridge (GET /query?domain=&type=). */
export async function fetchDnsQuery(domain: string, type = "A"): Promise<DnsQueryResult> {
  const res = await fetch(
    `${baseUrl()}/query?domain=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Bridge /query returned ${res.status}`);
  return await res.json();
}
