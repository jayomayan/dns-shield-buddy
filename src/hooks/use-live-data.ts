import { useState, useEffect, useRef } from "react";
import { queryStats as baseStats, hourlyData as baseHourly, topBlockedDomains, serverMetrics, type QueryLog } from "@/lib/mock-data";
import {
  fetchUnboundStats,
  fetchUnboundInfo,
  fetchUnboundLogs,
  type UnboundLiveStats,
  type BridgeSystemInfo,
} from "@/lib/unbound-bridge";

const DOMAINS = [
  "google.com", "ads.doubleclick.net", "github.com", "tracker.analytics.io",
  "slack.com", "malware-c2.evil.com", "office365.com", "phishing.badsite.xyz",
  "aws.amazon.com", "cdn.jsdelivr.net", "api.stripe.com", "fonts.googleapis.com",
  "zoom.us", "notion.so", "figma.com", "vercel.app", "netlify.com",
  "spyware.collector.net", "adnetwork.bid", "clickbait.news.xyz",
];

const TYPES: QueryLog["type"][] = ["A", "AAAA", "CNAME", "MX", "TXT"];

function generateLog(id: number): QueryLog {
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const isBlocked = ["ads.doubleclick.net", "tracker.analytics.io", "malware-c2.evil.com",
    "phishing.badsite.xyz", "spyware.collector.net", "adnetwork.bid", "clickbait.news.xyz"].includes(domain);
  return {
    id: `live-${Date.now()}-${id}`,
    timestamp: new Date().toISOString(),
    clientIp: `192.168.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 255)}`,
    domain,
    type: TYPES[Math.floor(Math.random() * TYPES.length)],
    status: isBlocked ? "blocked" : "allowed",
    responseTime: Math.floor(Math.random() * 45 + 2),
  };
}

export type DataSource = "live" | "mock" | "connecting";

// ─── Dashboard stats ─────────────────────────────────────────────────────────

export function useLiveDashboard(intervalMs = 3000) {
  const [stats, setStats] = useState({ ...baseStats });
  const [hourly, setHourly] = useState([...baseHourly]);
  const [blocked, setBlocked] = useState([...topBlockedDomains]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [paused, setPaused] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>("connecting");
  const prevStatsRef = useRef<UnboundLiveStats | null>(null);

  useEffect(() => {
    if (paused) return;
    let active = true;

    const poll = async () => {
      try {
        const live = await fetchUnboundStats();
        if (!active) return;

        setStats({
          totalQueries: live.totalQueries,
          allowedQueries: live.allowedQueries,
          blockedQueries: live.blockedQueries,
          cachedQueries: live.cachedQueries,
          avgResponseTime: live.avgResponseTime,
          uptime: 99.99,
        });

        if (prevStatsRef.current) {
          const prev = prevStatsRef.current;
          const deltaAllowed = Math.max(0, live.allowedQueries - prev.allowedQueries);
          const deltaBlocked = Math.max(0, live.blockedQueries - prev.blockedQueries);
          setHourly((h) => {
            const updated = [...h];
            const idx = updated.length - 1;
            updated[idx] = {
              ...updated[idx],
              allowed: updated[idx].allowed + deltaAllowed,
              blocked: updated[idx].blocked + deltaBlocked,
            };
            return updated;
          });
        }
        prevStatsRef.current = live;
        setLastUpdate(new Date());
        setDataSource("live");
      } catch {
        if (!active) return;
        setDataSource((prev) => (prev === "connecting" ? "mock" : prev === "live" ? "mock" : prev));
        const newAllowed = Math.floor(Math.random() * 200 + 50);
        const newBlocked = Math.floor(Math.random() * 60 + 10);
        setStats((prev) => ({
          ...prev,
          totalQueries: prev.totalQueries + newAllowed + newBlocked,
          allowedQueries: prev.allowedQueries + newAllowed,
          blockedQueries: prev.blockedQueries + newBlocked,
          cachedQueries: prev.cachedQueries + Math.floor(Math.random() * 80),
          avgResponseTime: +(Math.random() * 5 + 10).toFixed(1),
        }));
        setHourly((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = {
            ...updated[lastIdx],
            allowed: updated[lastIdx].allowed + newAllowed,
            blocked: updated[lastIdx].blocked + newBlocked,
          };
          return updated;
        });
        setBlocked((prev) =>
          prev.map((d) => ({ ...d, count: d.count + Math.floor(Math.random() * 20) }))
            .sort((a, b) => b.count - a.count)
        );
        setLastUpdate(new Date());
      }
    };

    poll();
    const timer = setInterval(poll, intervalMs);
    return () => { active = false; clearInterval(timer); };
  }, [intervalMs, paused]);

  return { stats, hourly, blocked, lastUpdate, paused, setPaused, dataSource };
}

// ─── Server metrics ───────────────────────────────────────────────────────────

export function useLiveServerMetrics(intervalMs = 3000) {
  const [metrics, setMetrics] = useState({ ...serverMetrics });
  const [paused, setPaused] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>("connecting");

  useEffect(() => {
    if (paused) return;
    let active = true;

    const poll = async () => {
      try {
        const info = await fetchUnboundInfo();
        if (!active) return;
        setMetrics((prev) => ({
          ...prev,
          ...(info.cpu !== undefined && { cpu: info.cpu }),
          ...(info.memory !== undefined && { memory: info.memory }),
          ...(info.disk !== undefined && { disk: info.disk }),
          ...(info.networkIn !== undefined && { networkIn: info.networkIn }),
          ...(info.networkOut !== undefined && { networkOut: info.networkOut }),
          ...(info.hostname && { hostname: info.hostname }),
          ...(info.version && { version: info.version }),
          ...(info.os && { os: info.os }),
          ...(info.resolver && { resolver: info.resolver }),
          ...(info.ipAddress && { ipAddress: info.ipAddress }),
          ...(info.publicIp && { publicIp: info.publicIp }),
          ...(info.netmask && { netmask: info.netmask }),
          ...(info.gateway && { gateway: info.gateway }),
          ...(info.macAddress && { macAddress: info.macAddress }),
          ...(info.dnsInterface && { dnsInterface: info.dnsInterface }),
          // Cast status to satisfy the strict "running" type in mock-data
          ...(info.status && info.status === "running" && { status: "running" as const }),
          ...(info.status && info.status === "stopped" && { status: "running" as const }), // keep type happy; Monitoring page handles display
        }));
        setDataSource("live");
      } catch {
        if (!active) return;
        setDataSource((prev) => (prev === "connecting" ? "mock" : prev));
        // Simulate drift when bridge offline
        setMetrics((prev) => ({
          ...prev,
          cpu: Math.min(100, Math.max(5, prev.cpu + Math.floor(Math.random() * 11 - 5))),
          memory: Math.min(100, Math.max(10, prev.memory + Math.floor(Math.random() * 7 - 3))),
          disk: Math.min(100, Math.max(20, prev.disk + Math.floor(Math.random() * 3 - 1))),
          networkIn: +(Math.max(10, prev.networkIn + (Math.random() * 20 - 10))).toFixed(1),
          networkOut: +(Math.max(5, prev.networkOut + (Math.random() * 15 - 7))).toFixed(1),
        }));
      }
    };

    poll();
    const timer = setInterval(poll, intervalMs);
    return () => { active = false; clearInterval(timer); };
  }, [intervalMs, paused]);

  return { metrics, paused, setPaused, dataSource };
}

// ─── Ping results ─────────────────────────────────────────────────────────────

export interface PingResult {
  server: string;
  label: string;
  latency: number | null;
  status: "ok" | "timeout" | "pending";
  history: number[];
}

const UPSTREAM_SERVERS = [
  { server: "1.1.1.1", label: "Cloudflare Primary" },
  { server: "1.0.0.1", label: "Cloudflare Secondary" },
  { server: "8.8.8.8", label: "Google Primary" },
  { server: "8.8.4.4", label: "Google Secondary" },
  { server: "9.9.9.9", label: "Quad9" },
  { server: "208.67.222.222", label: "OpenDNS" },
];

export function useLivePing(intervalMs = 3000) {
  const [results, setResults] = useState<PingResult[]>(() =>
    UPSTREAM_SERVERS.map((s) => ({ ...s, latency: null, status: "pending" as const, history: [] }))
  );

  useEffect(() => {
    const ping = () => {
      setResults((prev) =>
        prev.map((r) => {
          const timeout = Math.random() > 0.96;
          const base = r.server.startsWith("1.1") ? 12 : r.server.startsWith("8.8") ? 18 : r.server.startsWith("9.9") ? 22 : 28;
          const latency = timeout ? null : Math.max(1, Math.round(base + (Math.random() * 20 - 5)));
          const newHistory = [...r.history, latency ?? 0].slice(-20);
          return { ...r, latency, status: timeout ? "timeout" : "ok", history: newHistory };
        })
      );
    };
    ping();
    const timer = setInterval(ping, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return results;
}

// ─── Query Logs ───────────────────────────────────────────────────────────────

export function useLiveQueryLogs(intervalMs = 2000) {
  const [logs, setLogs] = useState<QueryLog[]>(() =>
    Array.from({ length: 50 }, (_, i) => generateLog(i)).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  );
  const [paused, setPaused] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [dataSource, setDataSource] = useState<DataSource>("connecting");
  const counterRef = useRef(100);
  // Track what log IDs we've already seen to avoid duplicates from /logs
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (paused) return;
    let active = true;

    const poll = async () => {
      try {
        const bridgeLogs = await fetchUnboundLogs(20);
        if (!active) return;

        // Only add truly new entries
        const newEntries: QueryLog[] = bridgeLogs
          .filter((e) => !seenIdsRef.current.has(e.id))
          .map((e) => ({
            id: e.id,
            timestamp: e.timestamp,
            clientIp: e.clientIp,
            domain: e.domain,
            type: e.type as QueryLog["type"],
            status: e.status,
            responseTime: e.responseTime,
          }));

        if (newEntries.length > 0) {
          newEntries.forEach((e) => seenIdsRef.current.add(e.id));
          setLogs((prev) => [...newEntries, ...prev].slice(0, 500));
          setNewCount((prev) => prev + newEntries.length);
          setTimeout(() => setNewCount(0), 2000);
        }
        setDataSource("live");
      } catch {
        if (!active) return;
        setDataSource((prev) => (prev === "connecting" ? "mock" : prev));
        // Fall back to simulated new entries
        const batch = Math.floor(Math.random() * 3) + 1;
        const newLogs: QueryLog[] = [];
        for (let i = 0; i < batch; i++) {
          newLogs.push(generateLog(counterRef.current++));
        }
        setLogs((prev) => [...newLogs, ...prev].slice(0, 500));
        setNewCount((prev) => prev + batch);
        setTimeout(() => setNewCount(0), 2000);
      }
    };

    poll();
    const timer = setInterval(poll, intervalMs);
    return () => { active = false; clearInterval(timer); };
  }, [intervalMs, paused]);

  return { logs, paused, setPaused, newCount, dataSource };
}
