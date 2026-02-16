import { useState } from "react";
import { Shield, ShieldX, Plus, Search, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { whitelistRules, blacklistRules } from "@/lib/mock-data";
import { motion } from "framer-motion";

type Tab = "whitelist" | "blacklist";

export default function DnsRules() {
  const [tab, setTab] = useState<Tab>("blacklist");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [wRules, setWRules] = useState(whitelistRules);
  const [bRules, setBRules] = useState(blacklistRules);

  const rules = tab === "whitelist" ? wRules : bRules;
  const filtered = rules.filter((r) => r.domain.toLowerCase().includes(search.toLowerCase()));

  const toggleRule = (id: string) => {
    const setter = tab === "whitelist" ? setWRules : setBRules;
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const deleteRule = (id: string) => {
    const setter = tab === "whitelist" ? setWRules : setBRules;
    setter((prev) => prev.filter((r) => r.id !== id));
  };

  const addRule = () => {
    if (!newDomain.trim()) return;
    const setter = tab === "whitelist" ? setWRules : setBRules;
    const newRule = {
      id: `new-${Date.now()}`,
      domain: newDomain,
      ...(tab === "blacklist" ? { category: "Custom" } : {}),
      tenant: "Global",
      createdAt: new Date().toISOString().split("T")[0],
      enabled: true,
    };
    setter((prev) => [newRule as any, ...prev]);
    setNewDomain("");
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setTab("blacklist")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "blacklist" ? "bg-destructive/10 text-destructive border border-destructive/30" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldX className="h-4 w-4" /> Blacklist ({bRules.length})
        </button>
        <button
          onClick={() => setTab("whitelist")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "whitelist" ? "bg-success/10 text-success border border-success/30" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="h-4 w-4" /> Whitelist ({wRules.length})
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains..."
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      </div>

      {/* Add Rule Form */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g. *.ads.example.com"
              className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && addRule()}
            />
            <button onClick={addRule} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              Add to {tab}
            </button>
          </div>
        </motion.div>
      )}

      {/* Rules Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Domain Pattern</th>
              {tab === "blacklist" && <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Category</th>}
              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Tenant</th>
              <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Created</th>
              <th className="text-center py-3 px-4 text-xs text-muted-foreground font-medium">Status</th>
              <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule: any) => (
              <tr key={rule.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-mono text-xs">{rule.domain}</td>
                {tab === "blacklist" && (
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
                      {rule.category}
                    </span>
                  </td>
                )}
                <td className="py-3 px-4 text-xs text-muted-foreground">{rule.tenant}</td>
                <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{rule.createdAt}</td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => toggleRule(rule.id)} className="text-muted-foreground hover:text-foreground">
                    {rule.enabled ? (
                      <ToggleRight className="h-5 w-5 text-success" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                </td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No rules found</div>
        )}
      </div>
    </div>
  );
}
