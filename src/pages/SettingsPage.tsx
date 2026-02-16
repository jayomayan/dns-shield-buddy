import { useState } from "react";
import { Save, Key, RotateCcw, Shield, FileText, Bell } from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [oktaDomain, setOktaDomain] = useState("");
  const [oktaClientId, setOktaClientId] = useState("");
  const [oktaSecret, setOktaSecret] = useState("");
  const [logRetention, setLogRetention] = useState("30");
  const [logRotation, setLogRotation] = useState("daily");
  const [maxLogSize, setMaxLogSize] = useState("500");
  const [notifyBlocked, setNotifyBlocked] = useState(true);
  const [notifyService, setNotifyService] = useState(true);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Okta SSO */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <Key className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Okta SSO Configuration</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Configure Okta Single Sign-On for enterprise authentication. Temporary admin access is available until Okta is configured.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Okta Domain</label>
            <input
              value={oktaDomain}
              onChange={(e) => setOktaDomain(e.target.value)}
              placeholder="https://your-org.okta.com"
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Client ID</label>
              <input
                value={oktaClientId}
                onChange={(e) => setOktaClientId(e.target.value)}
                placeholder="0oa1b2c3d4..."
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Client Secret</label>
              <input
                type="password"
                value={oktaSecret}
                onChange={(e) => setOktaSecret(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
            <Shield className="h-4 w-4 text-warning shrink-0" />
            <p className="text-xs text-warning">Okta not configured — temporary admin access enabled. Configure SSO to enforce enterprise authentication.</p>
          </div>
        </div>
      </motion.div>

      {/* Log Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Query Logging</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Configure DNS query log retention and rotation policies.</p>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Retention (days)</label>
              <input
                type="number"
                value={logRetention}
                onChange={(e) => setLogRetention(e.target.value)}
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Rotation</label>
              <select
                value={logRotation}
                onChange={(e) => setLogRotation(e.target.value)}
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Max Size (MB)</label>
              <input
                type="number"
                value={maxLogSize}
                onChange={(e) => setMaxLogSize(e.target.value)}
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Notifications</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Alert preferences for DNS events.</p>

        <div className="space-y-3">
          {[
            { label: "High blocked query volume alerts", checked: notifyBlocked, onChange: setNotifyBlocked },
            { label: "Service status change alerts", checked: notifyService, onChange: setNotifyService },
          ].map((item) => (
            <label key={item.label} className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
              <button
                onClick={() => item.onChange(!item.checked)}
                className={`relative w-10 h-5 rounded-full transition-colors ${item.checked ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-all ${item.checked ? "left-5" : "left-0.5"}`} />
              </button>
            </label>
          ))}
        </div>
      </motion.div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Save className="h-4 w-4" /> Save Changes
        </button>
      </div>
    </div>
  );
}
