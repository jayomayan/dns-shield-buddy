import { useState, useEffect } from "react";
import {
  Shield, ShieldX, Plus, Search, ToggleLeft, ToggleRight, Trash2,
  Gamepad2, MessageCircle, Video, ShoppingBag, Skull, Bug, BarChart3,
  Mail, Pickaxe, Globe, Layers, ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react";
import { whitelistRules, blacklistRules, categoryBlacklists, type CategoryBlacklist } from "@/lib/mock-data";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "categories" | "custom" | "whitelist";

const categoryIcons: Record<string, any> = {
  "Social Media": MessageCircle,
  "Gaming": Gamepad2,
  "Streaming & Video": Video,
  "Shopping": ShoppingBag,
  "Malware & Phishing": Skull,
  "Advertising & Tracking": BarChart3,
  "Adult Content": ShieldX,
  "Gambling": Pickaxe,
  "Spam": Mail,
  "Cryptomining": Bug,
};

const categoryColors: Record<string, string> = {
  "Social Media": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Gaming": "text-purple-400 bg-purple-400/10 border-purple-400/20",
  "Streaming & Video": "text-red-400 bg-red-400/10 border-red-400/20",
  "Shopping": "text-amber-400 bg-amber-400/10 border-amber-400/20",
  "Malware & Phishing": "text-destructive bg-destructive/10 border-destructive/20",
  "Advertising & Tracking": "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "Adult Content": "text-pink-400 bg-pink-400/10 border-pink-400/20",
  "Gambling": "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "Spam": "text-gray-400 bg-gray-400/10 border-gray-400/20",
  "Cryptomining": "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

export default function DnsRules() {
  const [tab, setTab] = useState<Tab>("categories");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [wRules, setWRules] = useState(() => {
    const saved = localStorage.getItem("dns-whitelist-rules");
    return saved ? JSON.parse(saved) : whitelistRules;
  });
  const [bRules, setBRules] = useState(() => {
    const saved = localStorage.getItem("dns-blacklist-rules");
    return saved ? JSON.parse(saved) : blacklistRules;
  });
  const [categories, setCategories] = useState<CategoryBlacklist[]>(() => {
    const saved = localStorage.getItem("dns-category-blacklists");
    return saved ? JSON.parse(saved) : categoryBlacklists;
  });
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem("dns-category-blacklists", JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem("dns-whitelist-rules", JSON.stringify(wRules)); }, [wRules]);
  useEffect(() => { localStorage.setItem("dns-blacklist-rules", JSON.stringify(bRules)); }, [bRules]);

  const filteredCustom = bRules.filter((r) => r.domain.toLowerCase().includes(search.toLowerCase()));
  const filteredWhitelist = wRules.filter((r) => r.domain.toLowerCase().includes(search.toLowerCase()));
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.domains.some((d) => d.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleCategory = (id: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  };

  const toggleRule = (id: string, list: "whitelist" | "blacklist") => {
    const setter = list === "whitelist" ? setWRules : setBRules;
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const deleteRule = (id: string, list: "whitelist" | "blacklist") => {
    const setter = list === "whitelist" ? setWRules : setBRules;
    setter((prev) => prev.filter((r) => r.id !== id));
  };

  const addRule = () => {
    if (!newDomain.trim()) return;
    if (tab === "whitelist") {
      setWRules((prev) => [{ id: `new-${Date.now()}`, domain: newDomain, createdAt: new Date().toISOString().split("T")[0], enabled: true }, ...prev]);
    } else {
      setBRules((prev) => [{ id: `new-${Date.now()}`, domain: newDomain, category: newCategory, createdAt: new Date().toISOString().split("T")[0], enabled: true }, ...prev]);
    }
    setNewDomain("");
    setShowAdd(false);
  };

  const resetToDefaults = () => {
    setCategories(categoryBlacklists);
    setWRules(whitelistRules);
    setBRules(blacklistRules);
  };

  const totalBlocked = categories.filter((c) => c.enabled).reduce((acc, c) => acc + c.domains.length, 0) + bRules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab("categories")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "categories" ? "bg-destructive/10 text-destructive border border-destructive/30" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" /> Categories ({categories.filter((c) => c.enabled).length}/{categories.length})
        </button>
        <button
          onClick={() => setTab("custom")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "custom" ? "bg-destructive/10 text-destructive border border-destructive/30" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldX className="h-4 w-4" /> Custom Blacklist ({bRules.length})
        </button>
        <button
          onClick={() => setTab("whitelist")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "whitelist" ? "bg-success/10 text-success border border-success/30" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="h-4 w-4" /> Whitelist ({wRules.length})
        </button>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </button>
          <span className="text-xs text-muted-foreground font-mono">
            {totalBlocked} domains blocked
          </span>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "categories" ? "Search categories or domains..." : "Search domains..."}
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {tab !== "categories" && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Rule
          </button>
        )}
      </div>

      {/* Add Rule Form */}
      <AnimatePresence>
        {showAdd && tab !== "categories" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g. *.ads.example.com"
                className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === "Enter" && addRule()}
              />
              {tab === "custom" && (
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Custom">Custom</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
              <button onClick={addRule} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                Add to {tab}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Cards */}
      {tab === "categories" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCategories.map((cat) => {
            const Icon = categoryIcons[cat.name] || Globe;
            const colors = categoryColors[cat.name] || "text-muted-foreground bg-muted/50 border-border";
            const isExpanded = expandedCat === cat.id;

            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-card border rounded-lg overflow-hidden transition-all ${cat.enabled ? "border-border" : "border-border/50 opacity-60"}`}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg border ${colors}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold">{cat.name}</h4>
                    <p className="text-[11px] text-muted-foreground">{cat.description}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{cat.domains.length} domains</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => toggleCategory(cat.id)}>
                      {cat.enabled ? (
                        <ToggleRight className="h-6 w-6 text-success" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border"
                    >
                      <div className="p-3 max-h-48 overflow-y-auto space-y-1">
                        {cat.domains.map((domain) => (
                          <div key={domain} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/30">
                            <span className="font-mono text-xs text-muted-foreground">{domain}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Custom Blacklist Table */}
      {tab === "custom" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Domain Pattern</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Category</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Created</th>
                <th className="text-center py-3 px-4 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustom.map((rule) => (
                <tr key={rule.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs">{rule.domain}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
                      {rule.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{rule.createdAt}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => toggleRule(rule.id, "blacklist")} className="text-muted-foreground hover:text-foreground">
                      {rule.enabled ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => deleteRule(rule.id, "blacklist")} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCustom.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No custom rules found</div>
          )}
        </div>
      )}

      {/* Whitelist Table */}
      {tab === "whitelist" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Domain Pattern</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Created</th>
                <th className="text-center py-3 px-4 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWhitelist.map((rule) => (
                <tr key={rule.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs">{rule.domain}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{rule.createdAt}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => toggleRule(rule.id, "whitelist")} className="text-muted-foreground hover:text-foreground">
                      {rule.enabled ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => deleteRule(rule.id, "whitelist")} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredWhitelist.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No whitelist rules found</div>
          )}
        </div>
      )}
    </div>
  );
}
