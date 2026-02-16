import { Globe, ShieldCheck, ShieldX, Zap, Clock, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import StatCard from "@/components/dashboard/StatCard";
import { queryStats, hourlyData, topBlockedDomains } from "@/lib/mock-data";
import { motion } from "framer-motion";

const pieData = [
  { name: "Allowed", value: queryStats.allowedQueries, color: "hsl(150, 70%, 45%)" },
  { name: "Blocked", value: queryStats.blockedQueries, color: "hsl(0, 72%, 55%)" },
  { name: "Cached", value: queryStats.cachedQueries, color: "hsl(38, 92%, 55%)" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Queries" value={queryStats.totalQueries} subtitle="Last 24 hours" icon={Globe} variant="primary" delay={0} />
        <StatCard title="Allowed" value={queryStats.allowedQueries} subtitle={`${((queryStats.allowedQueries / queryStats.totalQueries) * 100).toFixed(1)}% of total`} icon={ShieldCheck} variant="success" delay={0.05} />
        <StatCard title="Blocked" value={queryStats.blockedQueries} subtitle={`${((queryStats.blockedQueries / queryStats.totalQueries) * 100).toFixed(1)}% of total`} icon={ShieldX} variant="destructive" delay={0.1} />
        <StatCard title="Avg Response" value={`${queryStats.avgResponseTime}ms`} subtitle={`Uptime: ${queryStats.uptime}%`} icon={Zap} variant="warning" delay={0.15} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card border border-border rounded-lg p-5"
        >
          <h3 className="text-sm font-semibold mb-4">Query Volume (24h)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={hourlyData}>
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
              <Area type="monotone" dataKey="allowed" stroke="hsl(150, 70%, 45%)" fill="url(#allowedGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="blocked" stroke="hsl(0, 72%, 55%)" fill="url(#blockedGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-lg p-5"
        >
          <h3 className="text-sm font-semibold mb-4">Query Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={0}>
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
              {topBlockedDomains.slice(0, 6).map((item) => (
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
