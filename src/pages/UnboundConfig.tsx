import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Globe, Database, Cpu, Lock, Network, Plus, Trash2,
  Save, RotateCcw, Download, Copy, Check, ChevronDown, ChevronRight,
  Zap, Eye, EyeOff, FileCode,
} from "lucide-react";
import {
  defaultUnboundConfig,
  UnboundApiService,
  type UnboundConfig,
  type AccessControlRule,
  type ForwardingZone,
} from "@/lib/unbound-api";

type Tab = "general" | "dnssec" | "cache" | "forwarding" | "access" | "logging" | "config";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "general", label: "General", icon: Globe },
  { id: "dnssec", label: "DNSSEC", icon: Shield },
  { id: "cache", label: "Cache", icon: Database },
  { id: "forwarding", label: "Forwarding", icon: Network },
  { id: "access", label: "Access Control", icon: Lock },
  { id: "logging", label: "Logging", icon: Eye },
  { id: "config", label: "Config File", icon: FileCode },
];

export default function UnboundConfigPage() {
  const [config, setConfig] = useState<UnboundConfig>({ ...defaultUnboundConfig });
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const api = useMemo(() => new UnboundApiService(), []);

  const update = <K extends keyof UnboundConfig>(key: K, value: UnboundConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await api.updateConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const generatedConf = useMemo(() => UnboundApiService.generateConfig(config), [config]);

  const copyConfig = () => {
    navigator.clipboard.writeText(generatedConf);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadConfig = () => {
    const blob = new Blob([generatedConf], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unbound.conf";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helpers for sub-state
  const addForwardingZone = () => {
    const newZone: ForwardingZone = {
      id: `fz-${Date.now()}`,
      name: "",
      forwardAddresses: [""],
      forwardTlsUpstream: false,
      forwardFirst: false,
      enabled: true,
    };
    update("forwardingZones", [...config.forwardingZones, newZone]);
  };

  const updateZone = (id: string, patch: Partial<ForwardingZone>) => {
    update(
      "forwardingZones",
      config.forwardingZones.map((z) => (z.id === id ? { ...z, ...patch } : z))
    );
  };

  const removeZone = (id: string) => {
    update("forwardingZones", config.forwardingZones.filter((z) => z.id !== id));
  };

  const addAccessRule = () => {
    const newRule: AccessControlRule = {
      id: `ac-${Date.now()}`,
      subnet: "",
      action: "allow",
      comment: "",
    };
    update("accessControl", [...config.accessControl, newRule]);
  };

  const updateAccessRule = (id: string, patch: Partial<AccessControlRule>) => {
    update(
      "accessControl",
      config.accessControl.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const removeAccessRule = (id: string) => {
    update("accessControl", config.accessControl.filter((r) => r.id !== id));
  };

  const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "text-xs font-medium text-muted-foreground block mb-1.5";

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Unbound DNS Configuration</h2>
            <p className="text-xs text-muted-foreground">Manage your Unbound recursive resolver settings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfig({ ...defaultUnboundConfig })} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved!" : "Apply & Reload"}
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="bg-card border border-border rounded-lg p-6">
        {activeTab === "general" && (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Server Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Listen Interface</label>
                <input value={config.interface} onChange={(e) => update("interface", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Port</label>
                <input type="number" value={config.port} onChange={(e) => update("port", +e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Threads</label>
                <input type="number" value={config.numThreads} onChange={(e) => update("numThreads", +e.target.value)} className={inputClass} />
              </div>
            </div>
            <h4 className="text-xs font-semibold text-muted-foreground mt-4">Performance Tuning</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>Queries per Thread</label>
                <input type="number" value={config.numQueries} onChange={(e) => update("numQueries", +e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Outgoing Range</label>
                <input type="number" value={config.outgoingRange} onChange={(e) => update("outgoingRange", +e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>SO Receive Buffer</label>
                <input value={config.soRcvbuf} onChange={(e) => update("soRcvbuf", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>SO Send Buffer</label>
                <input value={config.soSndbuf} onChange={(e) => update("soSndbuf", e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "dnssec" && (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> DNSSEC Validation</h3>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
              <div>
                <p className="text-sm font-medium">Enable DNSSEC</p>
                <p className="text-xs text-muted-foreground">Validate DNS responses using cryptographic signatures</p>
              </div>
              <button onClick={() => update("dnssecEnabled", !config.dnssecEnabled)} className={`relative w-11 h-6 rounded-full transition-colors ${config.dnssecEnabled ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-all ${config.dnssecEnabled ? "left-6" : "left-1"}`} />
              </button>
            </div>
            {config.dnssecEnabled && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Trust Anchor File</label>
                  <input value={config.dnssecTrustAnchorFile} onChange={(e) => update("dnssecTrustAnchorFile", e.target.value)} className={inputClass} />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                  <div>
                    <p className="text-sm font-medium">Permissive Mode</p>
                    <p className="text-xs text-muted-foreground">Log validation failures but still serve responses (not recommended for production)</p>
                  </div>
                  <button onClick={() => update("valPermissiveMode", !config.valPermissiveMode)} className={`relative w-11 h-6 rounded-full transition-colors ${config.valPermissiveMode ? "bg-warning" : "bg-muted"}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-all ${config.valPermissiveMode ? "left-6" : "left-1"}`} />
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                  <p className="text-xs text-success flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> DNSSEC is active — DNS responses are cryptographically validated against the root trust anchor.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "cache" && (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Cache Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Min TTL (seconds)</label>
                <input type="number" value={config.cacheMinTtl} onChange={(e) => update("cacheMinTtl", +e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max TTL (seconds)</label>
                <input type="number" value={config.cacheMaxTtl} onChange={(e) => update("cacheMaxTtl", +e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max Negative TTL (seconds)</label>
                <input type="number" value={config.cacheMaxNegativeTtl} onChange={(e) => update("cacheMaxNegativeTtl", +e.target.value)} className={inputClass} />
              </div>
            </div>
            <h4 className="text-xs font-semibold text-muted-foreground mt-2">Memory Allocation</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Message Cache Size</label>
                <input value={config.msgCacheSize} onChange={(e) => update("msgCacheSize", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>RRset Cache Size</label>
                <input value={config.rrsetCacheSize} onChange={(e) => update("rrsetCacheSize", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Key Cache Size</label>
                <input value={config.keyCacheSize} onChange={(e) => update("keyCacheSize", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => api.flushCache()} className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs font-medium hover:bg-destructive/20 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Flush All Cache
              </button>
            </div>
          </div>
        )}

        {activeTab === "forwarding" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Forwarding Zones</h3>
              <button onClick={addForwardingZone} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Zone
              </button>
            </div>
            <div className="space-y-3">
              {config.forwardingZones.map((zone) => (
                <ForwardingZoneCard key={zone.id} zone={zone} onUpdate={(p) => updateZone(zone.id, p)} onRemove={() => removeZone(zone.id)} />
              ))}
            </div>
          </div>
        )}

        {activeTab === "access" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Access Control</h3>
              <button onClick={addAccessRule} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Rule
              </button>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Subnet</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Comment</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {config.accessControl.map((rule) => (
                    <tr key={rule.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <input value={rule.subnet} onChange={(e) => updateAccessRule(rule.id, { subnet: e.target.value })} className="bg-transparent border-none text-sm font-mono focus:outline-none w-full" placeholder="0.0.0.0/0" />
                      </td>
                      <td className="px-4 py-2">
                        <select value={rule.action} onChange={(e) => updateAccessRule(rule.id, { action: e.target.value as AccessControlRule["action"] })} className="bg-muted border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="allow">allow</option>
                          <option value="deny">deny</option>
                          <option value="refuse">refuse</option>
                          <option value="allow_snoop">allow_snoop</option>
                          <option value="allow_setrd">allow_setrd</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input value={rule.comment || ""} onChange={(e) => updateAccessRule(rule.id, { comment: e.target.value })} className="bg-transparent border-none text-sm text-muted-foreground focus:outline-none w-full" placeholder="Optional comment" />
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeAccessRule(rule.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "logging" && (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Logging Configuration</h3>
            <div>
              <label className={labelClass}>Verbosity Level (0-5)</label>
              <input type="number" min={0} max={5} value={config.verbosity} onChange={(e) => update("verbosity", +e.target.value)} className={inputClass + " max-w-[120px]"} />
              <p className="text-xs text-muted-foreground mt-1">0=errors only, 1=operational, 2=detailed, 3-5=debug</p>
            </div>
            <div className="space-y-3">
              {([
                { key: "logQueries" as const, label: "Log Queries", desc: "Log every incoming DNS query" },
                { key: "logReplies" as const, label: "Log Replies", desc: "Log DNS responses sent to clients" },
                { key: "logServfail" as const, label: "Log SERVFAIL", desc: "Log queries that result in SERVFAIL" },
                { key: "logLocalActions" as const, label: "Log Local Actions", desc: "Log local zone and policy actions" },
                { key: "useSystemd" as const, label: "Use systemd", desc: "Send logs to systemd journal instead of stderr" },
              ]).map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <button onClick={() => update(item.key, !config[item.key])} className={`relative w-11 h-6 rounded-full transition-colors ${config[item.key] ? "bg-primary" : "bg-muted"}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-all ${config[item.key] ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><FileCode className="h-4 w-4 text-primary" /> Generated unbound.conf</h3>
              <div className="flex gap-2">
                <button onClick={copyConfig} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={downloadConfig} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
              </div>
            </div>
            <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-auto max-h-[500px] leading-relaxed">
              {generatedConf}
            </pre>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ForwardingZoneCard({ zone, onUpdate, onRemove }: { zone: ForwardingZone; onUpdate: (p: Partial<ForwardingZone>) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-mono font-medium">{zone.name || "(unnamed zone)"}</span>
          {zone.forwardTlsUpstream && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-success/10 text-success border border-success/20">TLS</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onUpdate({ enabled: !zone.enabled }); }} className={`relative w-9 h-5 rounded-full transition-colors ${zone.enabled ? "bg-primary" : "bg-muted"}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-all ${zone.enabled ? "left-4" : "left-0.5"}`} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="p-4 space-y-3 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Zone Name</label>
              <input value={zone.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder='e.g. "." or "internal.corp"' className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={zone.forwardTlsUpstream} onChange={(e) => onUpdate({ forwardTlsUpstream: e.target.checked })} className="accent-primary" />
                <span className="text-xs">TLS Upstream</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={zone.forwardFirst} onChange={(e) => onUpdate({ forwardFirst: e.target.checked })} className="accent-primary" />
                <span className="text-xs">Forward First</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Forward Addresses</label>
            <div className="space-y-2">
              {zone.forwardAddresses.map((addr, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    value={addr}
                    onChange={(e) => {
                      const addrs = [...zone.forwardAddresses];
                      addrs[idx] = e.target.value;
                      onUpdate({ forwardAddresses: addrs });
                    }}
                    placeholder="1.1.1.1@853"
                    className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {zone.forwardAddresses.length > 1 && (
                    <button onClick={() => onUpdate({ forwardAddresses: zone.forwardAddresses.filter((_, i) => i !== idx) })} className="text-muted-foreground hover:text-destructive transition-colors px-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => onUpdate({ forwardAddresses: [...zone.forwardAddresses, ""] })} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
