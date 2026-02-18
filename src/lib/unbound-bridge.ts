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

/** Check if the bridge is reachable. */
export async function pingBridge(): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/stats`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
