// Unbound Bridge Client
// Fetches real data from the local unbound-bridge HTTP server running at localhost:8080
// The bridge executes `unbound-control stats` and returns key=value pairs as JSON.

const BRIDGE_URL = "http://localhost:8080";

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

export interface UnboundSystemInfo {
  status: "running" | "stopped" | "unknown";
  hostname: string;
  version: string;
  resolver: string;
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
  ipAddress: string;
  dnsPort: number;
  apiPort: number;
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
 * Reference: https://unbound.docs.nlnetlabs.nl/en/latest/manpages/unbound-control.html#unbound-control-stats
 */
export function parseUnboundStats(raw: UnboundRawStats): UnboundLiveStats {
  const total = parseInt2(raw["total.num.queries"]);
  const cacheHits = parseInt2(raw["total.num.cachehits"]);
  const cacheMiss = parseInt2(raw["total.num.cachemiss"]);
  const prefetch = parseInt2(raw["total.num.prefetch"]);
  const recursionAvg = parseFloat2(raw["total.recursion.time.avg"]);
  const uptime = parseFloat2(raw["time.elapsed"]);

  // Build query type breakdown from num.query.type.A, etc.
  const queryTypes: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    const m = key.match(/^num\.query\.type\.(.+)$/);
    if (m) queryTypes[m[1]] = parseInt2(val);
  }

  // Return code breakdown
  const returnCodes: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    const m = key.match(/^num\.answer\.rcode\.(.+)$/);
    if (m) returnCodes[m[1]] = parseInt2(val);
  }

  // Unbound doesn't have an explicit "blocked" counter — blocked queries are
  // answered with REFUSED or NXDOMAIN from local-zone actions.
  const blockedQueries =
    parseInt2(raw["num.answer.rcode.REFUSED"]) +
    parseInt2(raw["num.answer.secure"]) * 0; // placeholder; adjust per your blocklist setup

  const allowedQueries = Math.max(0, total - blockedQueries);

  return {
    totalQueries: total,
    allowedQueries,
    blockedQueries,
    cachedQueries: cacheHits,
    avgResponseTime: parseFloat((recursionAvg * 1000).toFixed(1)), // convert s → ms
    uptime: parseFloat((uptime / 3600).toFixed(2)), // in hours
    cacheHits,
    cacheMiss,
    prefetch,
    recursionAvg,
    queryTypes,
    returnCodes,
  };
}

/** Fetch live stats from the bridge. Throws on network error. */
export async function fetchUnboundStats(): Promise<UnboundLiveStats> {
  const res = await fetch(`${BRIDGE_URL}/stats`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
  const raw: UnboundRawStats = await res.json();
  return parseUnboundStats(raw);
}

/** Fetch system/health info from the bridge (/info endpoint, optional). */
export async function fetchUnboundInfo(): Promise<Partial<UnboundSystemInfo>> {
  try {
    const res = await fetch(`${BRIDGE_URL}/info`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/** Check if the bridge is reachable. */
export async function pingBridge(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/stats`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
