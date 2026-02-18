import { Cpu, HardDrive, MemoryStick, Wifi, Play, Square, RotateCcw, Server, Pause, Globe, Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useLiveServerMetrics, useLivePing } from "@/hooks/use-live-data";
import { motion } from "framer-motion";
import { useState } from "react";

function GaugeRing({ value, label, color, icon: Icon }: { value: number; label: string; color: string; icon: any }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(220, 14%, 18%)" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }} transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="h-4 w-4 mb-1" style={{ color }} />
          <span className="text-xl font-bold font-mono">{value}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export default function Monitoring() {
  const { metrics: serverMetrics, paused, setPaused } = useLiveServerMetrics(2000);
  const pingResults = useLivePing(4000);
  const [serviceStatus, setServiceStatus] = useState<"running" | "stopped">(serverMetrics.status);

  return (
    <div className="space-y-6">
      {/* DNS Service Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold">DNS Service Control</h3>
            <p className="text-xs text-muted-foreground mt-1">Manage the DNS resolver service</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            serviceStatus === "running" ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}>
            <div className={`w-2 h-2 rounded-full ${serviceStatus === "running" ? "bg-success animate-pulse-glow" : "bg-destructive"}`} />
            {serviceStatus === "running" ? "Running" : "Stopped"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setServiceStatus("running")}
            disabled={serviceStatus === "running"}
            className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success border border-success/20 rounded-lg text-sm font-medium hover:bg-success/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4" /> Start
          </button>
          <button
            onClick={() => setServiceStatus("stopped")}
            disabled={serviceStatus === "stopped"}
            className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Square className="h-4 w-4" /> Stop
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-warning/10 text-warning border border-warning/20 rounded-lg text-sm font-medium hover:bg-warning/20 transition-colors">
            <RotateCcw className="h-4 w-4" /> Restart
          </button>
          <button
            onClick={() => setPaused(!paused)}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors ml-auto"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Resume Metrics" : "Pause Metrics"}
          </button>
        </div>
      </motion.div>

      {/* Resource Gauges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <h3 className="text-sm font-semibold mb-6">Server Resources</h3>
        <div className="flex justify-around flex-wrap gap-6">
          <GaugeRing value={serverMetrics.cpu} label="CPU Usage" color="hsl(190, 95%, 50%)" icon={Cpu} />
          <GaugeRing value={serverMetrics.memory} label="Memory" color="hsl(38, 92%, 55%)" icon={MemoryStick} />
          <GaugeRing value={serverMetrics.disk} label="Disk" color="hsl(150, 70%, 45%)" icon={HardDrive} />
        </div>
      </motion.div>

      {/* System Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> System Information
          </h3>
          <div className="space-y-3">
            {[
              ["Hostname", serverMetrics.hostname],
              ["Version", serverMetrics.version],
              ["OS", serverMetrics.os],
              ["Resolver", serverMetrics.resolver],
              ["DNS Port", serverMetrics.dnsPort],
              ["API Port", serverMetrics.apiPort],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Network Addresses
          </h3>
          <div className="space-y-3">
            {[
              ["IP Address", serverMetrics.ipAddress],
              ["Public IP", serverMetrics.publicIp],
              ["Subnet Mask", serverMetrics.netmask],
              ["Gateway", serverMetrics.gateway],
              ["MAC Address", serverMetrics.macAddress],
              ["Interface", serverMetrics.dnsInterface],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" /> Network Traffic
          </h3>
          <div className="space-y-3">
            {[
              ["Inbound", `${serverMetrics.networkIn} MB/s`],
              ["Outbound", `${serverMetrics.networkOut} MB/s`],
              ["Upstream DNS", "1.1.1.1, 8.8.8.8"],
              ["Listening", "0.0.0.0:53"],
              ["Protocol", "UDP / TCP / DoH"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* DNS Latency Ping Test */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-lg p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Upstream DNS Latency
          </h3>
          <span className="text-[10px] text-muted-foreground font-mono">Live ping every 4s</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pingResults.map((r) => {
            const isOk = r.status === "ok";
            const isPending = r.status === "pending";
            const latencyColor =
              isPending ? "text-muted-foreground" :
              !isOk ? "text-destructive" :
              r.latency! < 20 ? "text-success" :
              r.latency! < 40 ? "text-warning" : "text-destructive";
            const barMax = 80;
            return (
              <div key={r.server} className="bg-muted/30 border border-border/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">{r.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{r.server}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isPending ? (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                    ) : isOk ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className={`text-sm font-bold font-mono ${latencyColor}`}>
                      {isPending ? "—" : isOk ? `${r.latency}ms` : "timeout"}
                    </span>
                  </div>
                </div>
                {/* Sparkline bars */}
                <div className="flex items-end gap-0.5 h-8">
                  {r.history.length === 0
                    ? Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="flex-1 bg-muted/50 rounded-sm" style={{ height: "4px" }} />
                      ))
                    : r.history.map((val, i) => {
                        const height = val === 0 ? 4 : Math.min(32, Math.max(4, (val / barMax) * 32));
                        const isLast = i === r.history.length - 1;
                        const color = val === 0 ? "bg-destructive/60" : val < 20 ? "bg-success/70" : val < 40 ? "bg-warning/70" : "bg-destructive/70";
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-sm transition-all duration-500 ${color} ${isLast ? "opacity-100" : "opacity-60"}`}
                            style={{ height: `${height}px` }}
                          />
                        );
                      })}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
