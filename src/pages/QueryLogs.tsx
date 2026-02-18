import { useState, useMemo } from "react";
import { Search, Download, Pause, Play, Radio } from "lucide-react";
import { useLiveQueryLogs } from "@/hooks/use-live-data";

export default function QueryLogs() {
  const { logs, paused, setPaused, newCount, dataSource } = useLiveQueryLogs(2000);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "allowed" | "blocked">("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch = log.domain.toLowerCase().includes(search.toLowerCase()) || log.clientIp.includes(search);
      const matchStatus = statusFilter === "all" || log.status === statusFilter;
      const matchType = typeFilter === "all" || log.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [logs, search, statusFilter, typeFilter]);

  const exportCSV = () => {
    const header = "Timestamp,Client IP,Domain,Type,Status,Response Time\n";
    const rows = filtered.map((l) => `${l.timestamp},${l.clientIp},${l.domain},${l.type},${l.status},${l.responseTime}ms`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dns-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Live bar + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Live indicator */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
          paused
            ? "bg-warning/10 text-warning border border-warning/20"
            : dataSource === "live"
            ? "bg-success/10 text-success border border-success/20"
            : dataSource === "connecting"
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-warning/10 text-warning border border-warning/20"
        }`}>
          {paused ? <Pause className="h-3 w-3" /> : <Radio className="h-3 w-3 animate-pulse-glow" />}
          {paused ? "PAUSED" : dataSource === "live" ? "LIVE · unbound" : dataSource === "connecting" ? "CONNECTING…" : "SIMULATED"}
        </div>

        {newCount > 0 && !paused && (
          <span className="text-[11px] font-mono text-primary">
            +{newCount} new
          </span>
        )}

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain or IP..."
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="allowed">Allowed</option>
          <option value="blocked">Blocked</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Types</option>
          <option value="A">A</option>
          <option value="AAAA">AAAA</option>
          <option value="CNAME">CNAME</option>
          <option value="MX">MX</option>
          <option value="TXT">TXT</option>
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setPaused(!paused)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{filtered.length} entries ({logs.length} total buffered)</p>

      {/* Logs Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Timestamp</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Client IP</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Domain</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Type</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Response</th>
                
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((log, i) => (
                <tr
                  key={log.id}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs">{log.clientIp}</td>
                  <td className="py-2.5 px-4 font-mono text-xs">{log.domain}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">{log.type}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        log.status === "allowed"
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">{log.responseTime}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
