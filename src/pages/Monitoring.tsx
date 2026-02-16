import { Cpu, HardDrive, MemoryStick, Wifi, Play, Square, RotateCcw, Server, Pause } from "lucide-react";
import { useLiveServerMetrics } from "@/hooks/use-live-data";
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
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> System Information
          </h3>
          <div className="space-y-3">
            {[
              ["Version", serverMetrics.version],
              ["OS", serverMetrics.os],
              ["Resolver", "Unbound 1.19.0"],
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
            <Wifi className="h-4 w-4 text-primary" /> Network
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
    </div>
  );
}
