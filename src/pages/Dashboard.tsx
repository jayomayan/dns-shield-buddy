import { Globe, ShieldCheck, ShieldX, Zap, ArrowUpRight, Pause, Play, Radio } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import StatCard from "@/components/dashboard/StatCard";
import { useLiveDashboard } from "@/hooks/use-live-data";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const { stats, hourly, blocked, lastUpdate, paused, setPaused, dataSource } = useLiveDashboard(3000);

  const pieData = [
    { name: "Allowed", value: stats.allowedQueries, color: "hsl(150, 70%, 45%)" },
    { name: "Blocked", value: stats.blockedQueries, color: "hsl(0, 72%, 55%)" },
    { name: "Cached", value: stats.cachedQueries, color: "hsl(38, 92%, 55%)" },
  ];

  return (
    <div className="space-y-6">
      {/* Live indicator bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
          <span className="text-[11px] text-muted-foreground font-mono">
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
          {dataSource === "mock" && !paused && (
            <span className="text-[10px] text-warning/70 font-mono">Bridge offline — using simulated data</span>
          )}
        </div>
        <button
          onClick={() => setPaused(!paused)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Queries" value={stats.totalQueries} subtitle="Last 24 hours" icon={Globe} variant="primary" delay={0} />
        <StatCard title="Allowed" value={stats.allowedQueries} subtitle={`${((stats.allowedQueries / stats.totalQueries) * 100).toFixed(1)}% of total`} icon={ShieldCheck} variant="success" delay={0.05} />
        <StatCard title="Blocked" value={stats.blockedQueries} subtitle={`${((stats.blockedQueries / stats.totalQueries) * 100).toFixed(1)}% of total`} icon={ShieldX} variant="destructive" delay={0.1} />
        <StatCard title="Avg Response" value={`${stats.avgResponseTime}ms`} subtitle={`Uptime: ${stats.uptime}%`} icon={Zap} variant="warning" delay={0.15} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card border border-border rounded-lg p-5"
        >
          <h3 className="text-sm font-semibold mb-4">Query Volume (24h)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={hourly}>
              <defs>
                <linearGradient id="allowedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(150, 70%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(150, 70%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "hsl(210, 20%, 92%)" }}
              />
              <Area type="monotone" dataKey="allowed" stroke="hsl(150, 70%, 45%)" fill="url(#allowedGrad)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="blocked" stroke="hsl(0, 72%, 55%)" fill="url(#blockedGrad)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-lg p-5"
        >
          <h3 className="text-sm font-semibold mb-4">Query Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={0} isAnimationActive={false}>
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-mono font-medium">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Blocked */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-lg p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Top Blocked Domains</h3>
          <button className="text-xs text-primary flex items-center gap-1 hover:underline">
            View All <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Domain</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Category</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Blocked</th>
              </tr>
            </thead>
            <tbody>
              {blocked.slice(0, 6).map((item) => (
                <tr key={item.domain} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 font-mono text-xs">{item.domain}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs">{item.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
