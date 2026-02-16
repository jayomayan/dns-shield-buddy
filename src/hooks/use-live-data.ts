import { useState, useEffect, useCallback, useRef } from "react";
import { queryStats as baseStats, hourlyData as baseHourly, topBlockedDomains, type QueryLog } from "@/lib/mock-data";

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

export function useLiveDashboard(intervalMs = 3000) {
  const [stats, setStats] = useState({ ...baseStats });
  const [hourly, setHourly] = useState([...baseHourly]);
  const [blocked, setBlocked] = useState([...topBlockedDomains]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
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
        prev.map((d) => ({
          ...d,
          count: d.count + Math.floor(Math.random() * 20),
        })).sort((a, b) => b.count - a.count)
      );

      setLastUpdate(new Date());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, paused]);

  return { stats, hourly, blocked, lastUpdate, paused, setPaused };
}

export function useLiveQueryLogs(intervalMs = 2000) {
  const [logs, setLogs] = useState<QueryLog[]>(() => {
    // Generate initial batch
    return Array.from({ length: 50 }, (_, i) => generateLog(i)).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });
  const [paused, setPaused] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const counterRef = useRef(100);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      const batch = Math.floor(Math.random() * 3) + 1;
      const newLogs: QueryLog[] = [];
      for (let i = 0; i < batch; i++) {
        newLogs.push(generateLog(counterRef.current++));
      }
      setLogs((prev) => [...newLogs, ...prev].slice(0, 500));
      setNewCount((prev) => prev + batch);
      // Reset new count indicator after 2s
      setTimeout(() => setNewCount(0), 2000);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, paused]);

  return { logs, paused, setPaused, newCount };
}
