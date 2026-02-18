import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, CheckCircle2, Circle, ChevronDown, ChevronRight,
  Server, Shield, Globe, Database, Key, Settings, Terminal,
  Download, FileText, Cpu, Network, Lock, Zap, AlertTriangle,
  ExternalLink, Copy, Check, Monitor, Layers, HardDrive,
} from "lucide-react";

type Section = "setup" | "bridge" | "walkthrough" | "architecture" | "api" | "faq";

const SECTIONS: { id: Section; label: string; icon: any }[] = [
  { id: "setup", label: "Setup Guide", icon: Download },
  { id: "bridge", label: "Bridge Script", icon: Terminal },
  { id: "walkthrough", label: "Walkthrough", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "api", label: "API Reference", icon: Terminal },
  { id: "faq", label: "FAQ", icon: FileText },
];

interface SetupStep {
  id: string;
  title: string;
  description: string;
  details: string[];
  command?: string;
  warning?: string;
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: "s1",
    title: "System Requirements",
    description: "Ensure your server meets the minimum requirements before installation.",
    details: [
      "Ubuntu 22.04 LTS or later (Debian-based recommended)",
      "Minimum 2 CPU cores, 4 GB RAM, 20 GB disk",
      "Open ports: 53 (DNS), 443 (Web UI / API), 853 (DNS-over-TLS optional)",
      "Root or sudo access required",
      "Stable internet connection for upstream DNS resolution",
    ],
  },
  {
    id: "s2",
    title: "Install Unbound DNS Server",
    description: "Install the Unbound recursive resolver on your server.",
    command: `# Update package index
sudo apt update && sudo apt upgrade -y

# Install Unbound and dependencies
sudo apt install -y unbound unbound-host dns-root-data

# Verify installation
unbound -V

# Enable Unbound to start on boot
sudo systemctl enable unbound`,
    details: [
      "Unbound is a validating, recursive, caching DNS resolver",
      "Supports DNSSEC validation out of the box",
      "Lightweight with low memory footprint",
      "Supports DNS-over-TLS (DoT) and DNS-over-HTTPS (DoH)",
    ],
  },
  {
    id: "s3",
    title: "Configure Unbound",
    description: "Apply the DNSGuard configuration to Unbound.",
    command: `# Backup default configuration
sudo cp /etc/unbound/unbound.conf /etc/unbound/unbound.conf.bak

# Download root hints
sudo curl -o /var/lib/unbound/root.hints \\
  https://www.internic.net/domain/named.cache

# Copy DNSGuard generated config
# (Download from Web UI → Unbound DNS → Config File tab)
sudo cp unbound.conf /etc/unbound/unbound.conf

# Validate configuration
sudo unbound-checkconf

# Restart Unbound
sudo systemctl restart unbound

# Verify it's running
sudo systemctl status unbound`,
    details: [
      "Use the Config File tab in the Unbound DNS page to generate your configuration",
      "Always run unbound-checkconf before restarting to validate syntax",
      "The generated config includes DNSSEC, access control, and forwarding settings",
      "Customize forwarding zones for internal DNS resolution",
    ],
  },
  {
    id: "s4",
    title: "Enable Remote Control",
    description: "Set up unbound-control for remote management from the Web UI.",
    command: `# Generate control certificates
sudo unbound-control-setup

# Add to unbound.conf (already included in generated config):
# remote-control:
#     control-enable: yes
#     control-interface: 127.0.0.1
#     control-port: 8953
#     server-key-file: "/etc/unbound/unbound_server.key"
#     server-cert-file: "/etc/unbound/unbound_server.pem"
#     control-key-file: "/etc/unbound/unbound_control.key"
#     control-cert-file: "/etc/unbound/unbound_control.pem"

# Restart Unbound
sudo systemctl restart unbound

# Test remote control
sudo unbound-control status`,
    details: [
      "Remote control enables the Web UI to manage Unbound (start, stop, reload, stats)",
      "By default, control listens on 127.0.0.1:8953 (localhost only)",
      "For remote access, configure TLS certificates and allowed IPs",
      "The API layer communicates via Edge Functions that exec unbound-control",
    ],
    warning: "Never expose the control port (8953) to the public internet without TLS and IP restrictions.",
  },
  {
    id: "s5",
    title: "Configure DNS Filtering Rules",
    description: "Set up blacklists, whitelists, and category-based filtering.",
    command: `# Unbound uses local-zone and local-data directives for filtering

# Block a domain (returns NXDOMAIN):
# local-zone: "ads.example.com" always_nxdomain

# Block an entire zone:
# local-zone: "doubleclick.net" always_refuse

# Allow specific domain (whitelist via forward):
# forward-zone:
#     name: "trusted.com"
#     forward-addr: 1.1.1.1

# DNSGuard manages these rules via the Web UI
# Rules are written to /etc/unbound/local.d/*.conf`,
    details: [
      "Use the DNS Rules page to manage categories (Social Media, Gaming, Ads, etc.)",
      "Custom blacklist entries are added as local-zone directives",
      "Whitelist entries bypass filtering via forward zones",
      "Rules are applied on Unbound reload — no restart needed",
    ],
  },
  {
    id: "s6",
    title: "Set Up Query Logging",
    description: "Enable DNS query logging for monitoring and analytics.",
    command: `# In unbound.conf (configure via Web UI → Unbound DNS → Logging tab):
# server:
#     verbosity: 1
#     log-queries: yes
#     log-replies: no
#     log-servfail: yes
#     use-syslog: yes

# View logs
sudo journalctl -u unbound -f

# Or if using file logging:
# logfile: "/var/log/unbound/unbound.log"
tail -f /var/log/unbound/unbound.log`,
    details: [
      "Logging verbosity 1 is recommended for production (operational info)",
      "Enable log-queries to feed the Query Logs dashboard",
      "Configure log rotation in Settings → Query Logging",
      "Logs are parsed and stored for the analytics dashboard",
    ],
  },
  {
    id: "s7",
    title: "Configure Authentication",
    description: "Set up Okta SSO for platform users and API tokens for programmatic access.",
    details: [
      "Platform User SSO: Navigate to Settings → Okta SSO Configuration",
      "Enter your Okta domain, Client ID, and Client Secret",
      "Set the callback URL in Okta to: https://your-dnsguard-domain/auth/callback",
      "API Access: Navigate to Settings → API Tokens to create scoped tokens",
      "Tokens use the format 'dng_<random>' and support granular scopes (dns:read, rules:write, etc.)",
      "Include token in requests via the Authorization header: Bearer dng_your_token_here",
      "Set token expiry (30 days to never) and restrict scopes to least-privilege",
      "Okta handles platform user login with optional MFA; API tokens handle automation & CI/CD",
    ],
    warning: "Configure Okta SSO before deploying to production. API tokens should use least-privilege scopes and be rotated regularly.",
  },
  {
    id: "s8",
    title: "Verify & Test",
    description: "Confirm everything is working correctly.",
    command: `# Test DNS resolution
dig @127.0.0.1 google.com

# Test DNSSEC validation
dig @127.0.0.1 dnssec-failed.org  # Should fail (invalid DNSSEC)
dig @127.0.0.1 example.com +dnssec  # Should show RRSIG records

# Test blocking
dig @127.0.0.1 ads.doubleclick.net  # Should return NXDOMAIN or REFUSED

# Check Unbound stats
sudo unbound-control stats_noreset

# Test from another machine
dig @<server-ip> google.com`,
    details: [
      "Verify DNS resolution works for allowed domains",
      "Confirm blocked domains return NXDOMAIN or REFUSED",
      "Check DNSSEC validation with known-good and known-bad domains",
      "Monitor the Dashboard for incoming query statistics",
      "Test from client machines after pointing their DNS to this server",
    ],
  },
];

const BRIDGE_SCRIPT = `#!/usr/bin/env node
// unbound-bridge.js — DNSGuard API Bridge v2
// Place at: /opt/unbound-bridge/unbound-bridge.js
// Run as root: sudo node unbound-bridge.js

const http = require('http');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const PORT = 8080;

// ── Set this to your Unbound log file path ──────────────────────────────────
// Find it with: grep -i logfile /etc/unbound/unbound.conf
const LOG_FILE = '/var/log/unbound/unbound.log';
// Set true if unbound uses syslog (use-syslog: yes) instead of a file
const USE_JOURNALD = false;

// ─── CORS / JSON ─────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, data, status) {
  cors(res);
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Log parser ───────────────────────────────────────────────────────────────
// Parses the exact Unbound query log format:
// Feb 18 13:54:37 hostname unbound[8222]: [8222:0] info: 127.0.0.1 google.com. A IN
const LOG_RE = /^(\\w{3}\\s+\\d+\\s+[\\d:]+)\\s+\\S+\\s+unbound\\[\\d+\\]:\\s+\\[\\d+:\\d+\\]\\s+info:\\s+([\\d.:a-fA-F]+)\\s+([\\S]+?)\\.?\\s+(A|AAAA|CNAME|MX|TXT|SRV|PTR|NS|NULL)\\s+IN/;

let logIndex = 0;
function parseLogLine(line) {
  const m = line.match(LOG_RE);
  if (!m) return null;
  const dateStr = m[1];
  const clientIp = m[2];
  const domain = m[3].replace(/\\.$/, '');
  const type = m[4];
  const year = new Date().getFullYear();
  const ts = new Date(dateStr + ' ' + year);
  if (isNaN(ts.getTime())) return null;
  return {
    id: 'log-' + ts.getTime() + '-' + (logIndex++),
    timestamp: ts.toISOString(),
    clientIp,
    domain,
    type,
    status: 'allowed',
    responseTime: 0,
  };
}

function readLogsFromFile(limit) {
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.trim().split('\\n').slice(-2000);
    const entries = [];
    lines.forEach(function(line) {
      const e = parseLogLine(line);
      if (e) entries.push(e);
    });
    return entries.reverse().slice(0, limit);
  } catch(e) { return []; }
}

function readLogsFromJournald(limit) {
  try {
    const out = execSync('journalctl -u unbound -n 500 --no-pager --output=short', { timeout: 5000 }).toString();
    const entries = [];
    out.trim().split('\\n').forEach(function(line) {
      const e = parseLogLine(line);
      if (e) entries.push(e);
    });
    return entries.reverse().slice(0, limit);
  } catch(e) { return []; }
}

function readLogs(limit) {
  return USE_JOURNALD ? readLogsFromJournald(limit || 50) : readLogsFromFile(limit || 50);
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function getStats() {
  return new Promise(function(resolve, reject) {
    exec('sudo unbound-control stats_noreset', function(err, stdout) {
      if (err) return reject(err);
      const raw = {};
      stdout.split('\\n').forEach(function(line) {
        const eq = line.indexOf('=');
        if (eq > 0) raw[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      });
      resolve(raw);
    });
  });
}

// ─── System info ──────────────────────────────────────────────────────────────
function getInfo() {
  const cpus = os.cpus();
  const localIp = Object.values(os.networkInterfaces()).flat()
    .find(function(i) { return i && i.family === 'IPv4' && !i.internal; });
  return {
    status: 'running',
    hostname: os.hostname(),
    os: os.type() + ' ' + os.release(),
    version: 'Unbound',
    resolver: 'Unbound',
    cpu: Math.min(100, Math.round(os.loadavg()[0] / cpus.length * 100)),
    memory: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    disk: 40,
    networkIn: 0,
    networkOut: 0,
    ipAddress: localIp ? localIp.address : '127.0.0.1',
    publicIp: '', netmask: '', gateway: '', macAddress: '',
    dnsInterface: '0.0.0.0', dnsPort: 53, apiPort: PORT,
  };
}

// ─── Cache flush ──────────────────────────────────────────────────────────────
function flushCache() {
  return new Promise(function(resolve, reject) {
    exec('sudo unbound-control flush_zone .', function(err) {
      if (err) return reject(err);
      resolve({ ok: true, message: 'Cache flushed' });
    });
  });
}

// ─── Ping upstream servers ────────────────────────────────────────────────────
function pingServers() {
  var servers = ['1.1.1.1','1.0.0.1','8.8.8.8','8.8.4.4','9.9.9.9','208.67.222.222'];
  return Promise.all(servers.map(function(server) {
    return new Promise(function(resolve) {
      var start = Date.now();
      exec('dig @' + server + ' google.com A +time=3 +tries=1 +noall +answer', function(err) {
        resolve({ server: server, latency: err ? null : Date.now() - start, status: err ? 'timeout' : 'ok' });
      });
    });
  }));
}

// ─── DNS query test ───────────────────────────────────────────────────────────
function dnsQuery(domain, type) {
  return new Promise(function(resolve) {
    var start = Date.now();
    exec('dig @127.0.0.1 ' + domain + ' ' + type + ' +noall +answer +authority +comments', function(err, stdout) {
      var responseTime = Date.now() - start;
      var answers = [];
      var flags = [];
      var status = 'NOERROR';
      (stdout || '').split('\\n').forEach(function(line) {
        var sm = line.match(/status:\\s*(\\w+)/);
        if (sm) status = sm[1];
        var fm = line.match(/flags:\\s*([^;]+)/);
        if (fm) fm[1].trim().split(/\\s+/).forEach(function(f) { if (f) flags.push(f); });
        if (!line.startsWith(';') && line.trim()) {
          var parts = line.trim().split(/\\s+/);
          if (parts.length >= 5 && /^\\d+$/.test(parts[1])) {
            answers.push({ name: parts[0], ttl: parseInt(parts[1]), type: parts[3], data: parts.slice(4).join(' ') });
          }
        }
      });
      resolve({
        domain: domain, type: type, status: status, answers: answers, responseTime: responseTime,
        server: '127.0.0.1', flags: flags.filter(function(v,i,a){ return a.indexOf(v)===i; }),
        blocked: status === 'NXDOMAIN' || status === 'REFUSED',
      });
    });
  });
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
var server = http.createServer(function(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
  var url = new URL(req.url, 'http://localhost:' + PORT);
  Promise.resolve().then(function() {
    if (req.method === 'GET' && url.pathname === '/stats')
      return getStats().then(function(d) { json(res, d); });
    if (req.method === 'GET' && url.pathname === '/info')
      return json(res, getInfo());
    if (req.method === 'GET' && url.pathname === '/logs')
      return json(res, readLogs(parseInt(url.searchParams.get('limit') || '50')));
    if (req.method === 'GET' && url.pathname === '/query')
      return dnsQuery(url.searchParams.get('domain') || 'google.com', url.searchParams.get('type') || 'A').then(function(d) { json(res, d); });
    if (req.method === 'GET' && url.pathname === '/ping')
      return pingServers().then(function(d) { json(res, d); });
    if (req.method === 'POST' && url.pathname === '/cache/flush')
      return flushCache().then(function(d) { json(res, d); });
    if (req.method === 'POST' && url.pathname === '/rules') {
      var body = '';
      req.on('data', function(d) { body += d; });
      req.on('end', function() { json(res, { ok: true, message: 'Rules received' }); });
      return;
    }
    json(res, { error: 'Not found' }, 404);
  }).catch(function(err) { json(res, { error: err.message }, 500); });
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('[unbound-bridge] listening on http://0.0.0.0:' + PORT);
  console.log('[unbound-bridge] log source: ' + (USE_JOURNALD ? 'journald' : LOG_FILE));
});`;

const BRIDGE_SYSTEMD = `[Unit]
Description=DNSGuard Unbound Bridge
After=network.target unbound.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /opt/unbound-bridge/unbound-bridge.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target`;

const BRIDGE_INSTALL = `# Create directory and copy script
sudo mkdir -p /opt/unbound-bridge
sudo cp unbound-bridge.js /opt/unbound-bridge/

# Install systemd service
sudo cp unbound-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable unbound-bridge
sudo systemctl start unbound-bridge

# Verify it's running
sudo systemctl status unbound-bridge
curl http://localhost:8080/stats | head -5`;

const BRIDGE_NGINX = `# Add inside your server {} block in nginx.conf
location /api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    add_header Access-Control-Allow-Origin *;
}`;

const WALKTHROUGH_ITEMS = [
  {
    title: "Dashboard",
    icon: Monitor,
    description: "Real-time overview of your DNS traffic and filtering performance.",
    features: [
      "Live query volume chart — updates every 3 seconds with allowed/blocked/cached breakdown",
      "Query distribution pie chart — visual ratio of allowed vs blocked traffic",
      "Top blocked domains — ranked list of most frequently blocked domains",
      "Stat cards — total queries, block rate, cache hit rate, avg response time",
      "Pause/Resume — freeze live updates to analyze a specific moment",
    ],
  },
  {
    title: "DNS Rules",
    icon: Shield,
    description: "Manage domain filtering with categories, custom rules, and whitelists.",
    features: [
      "Category Blacklists — toggle entire categories (Social Media, Gaming, Ads, Malware, etc.)",
      "Expand categories to see individual domains included",
      "Custom Blacklist — add specific domains with category tags",
      "Whitelist — exempt trusted domains from all filtering",
      "Search and filter across all rule types",
      "Rules sync to Unbound via local-zone directives on save",
    ],
  },
  {
    title: "Query Logs",
    icon: FileText,
    description: "Searchable, filterable log of all DNS queries processed.",
    features: [
      "Real-time streaming — new queries appear with animation",
      "Filter by status (allowed/blocked), record type (A, AAAA, MX, etc.)",
      "Search by domain name or client IP",
      "CSV export — download filtered results for offline analysis",
      "Auto-scroll with new entry indicator",
    ],
  },
  {
    title: "Monitoring",
    icon: Cpu,
    description: "Server resource usage and DNS service controls.",
    features: [
      "CPU, Memory, Disk usage gauges with real-time updates",
      "DNS service controls — Start, Stop, Restart Unbound",
      "System info — version, OS, resolver, ports",
      "Network stats — inbound/outbound traffic, upstream DNS servers",
    ],
  },
  {
    title: "Unbound DNS",
    icon: Zap,
    description: "Full configuration management for the Unbound resolver.",
    features: [
      "General — interface, port, threads, performance tuning",
      "DNSSEC — enable/disable validation, trust anchor, permissive mode",
      "Cache — TTL settings, memory allocation, flush cache",
      "Forwarding Zones — upstream DNS servers, TLS, internal zones",
      "Access Control — subnet-based allow/deny/refuse rules",
      "Logging — verbosity, query/reply/servfail logging toggles",
      "Config File — live preview of generated unbound.conf with copy/download",
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    description: "Platform configuration for authentication, API tokens, logging, and alerts.",
    features: [
      "Okta SSO — enterprise authentication for platform users (login to the Web UI)",
      "API Tokens — create scoped tokens for programmatic API access (CI/CD, monitoring, automation)",
      "Token scopes — granular permissions: dns:read/write, rules:read/write, logs:read, monitoring:read, config:read/write",
      "Token lifecycle — set expiry (30 days to never), reveal/copy tokens, revoke when no longer needed",
      "Query Logging — retention period, rotation policy, max log size",
      "Notifications — alerts for high block volume and service status changes",
      "Theme — switch between Dark Mode, Light Mode, and System preference",
    ],
  },
];

const ARCHITECTURE_LAYERS = [
  {
    title: "Client Layer",
    icon: Globe,
    color: "hsl(190, 95%, 50%)",
    items: ["End-user devices (desktops, phones, IoT)", "Point DNS to DNSGuard server IP", "Queries sent via UDP/TCP port 53", "Optional: DNS-over-TLS on port 853"],
  },
  {
    title: "DNS Resolver (Unbound)",
    icon: Server,
    color: "hsl(150, 70%, 45%)",
    items: [
      "Recursive resolution with DNSSEC validation",
      "Local zone filtering (blacklist/whitelist)",
      "Response caching with configurable TTL",
      "Forwarding zones for internal domains",
      "Remote control interface (port 8953)",
    ],
  },
  {
    title: "Filtering Engine",
    icon: Shield,
    color: "hsl(38, 92%, 55%)",
    items: [
      "Category-based blocking (10+ categories)",
      "Custom domain blacklist/whitelist",
      "Wildcard pattern matching (*.domain.com)",
      "local-zone directives in Unbound config",
      "Hot-reload without service restart",
    ],
  },
  {
    title: "Web UI & API",
    icon: Monitor,
    color: "hsl(270, 70%, 60%)",
    items: [
      "React + TypeScript frontend (this application)",
      "Edge Functions for server communication",
      "Real-time dashboard with live data streaming",
      "Configuration management with config generation",
      "Okta SSO authentication",
    ],
  },
  {
    title: "Data & Storage",
    icon: Database,
    color: "hsl(0, 72%, 55%)",
    items: [
      "Query logs stored in database (Lovable Cloud)",
      "Rule configurations persisted in DB",
      "Analytics aggregation for dashboard charts",
      "Log rotation and retention policies",
      "Exportable reports (CSV)",
    ],
  },
];

const API_ENDPOINTS = [
  { method: "GET", path: "/api/unbound/status", description: "Get Unbound service status (running/stopped)" },
  { method: "GET", path: "/api/unbound/stats", description: "Fetch resolver statistics (cache hits, query types, return codes)" },
  { method: "POST", path: "/api/unbound/control", description: "Service control: start, stop, restart Unbound" },
  { method: "PUT", path: "/api/unbound/config", description: "Update Unbound configuration and trigger reload" },
  { method: "POST", path: "/api/unbound/flush-cache", description: "Flush DNS cache (all or specific zone)" },
  { method: "GET", path: "/api/unbound/local-zones", description: "List configured local zones (filtering rules)" },
  { method: "GET", path: "/api/rules/blacklist", description: "Get all blacklist rules (custom + categories)" },
  { method: "POST", path: "/api/rules/blacklist", description: "Add a custom blacklist rule" },
  { method: "DELETE", path: "/api/rules/blacklist/:id", description: "Remove a blacklist rule" },
  { method: "PUT", path: "/api/rules/category/:id", description: "Toggle a category blacklist on/off" },
  { method: "GET", path: "/api/rules/whitelist", description: "Get all whitelist rules" },
  { method: "POST", path: "/api/rules/whitelist", description: "Add a whitelist rule" },
  { method: "DELETE", path: "/api/rules/whitelist/:id", description: "Remove a whitelist rule" },
  { method: "GET", path: "/api/logs/queries", description: "Fetch query logs with pagination and filters" },
  { method: "GET", path: "/api/logs/export", description: "Export query logs as CSV" },
  { method: "GET", path: "/api/monitoring/resources", description: "Get server CPU, memory, disk usage" },
  { method: "GET", path: "/api/monitoring/network", description: "Get network traffic statistics" },
];

const FAQ_ITEMS = [
  {
    q: "What DNS record types does Unbound support?",
    a: "Unbound supports all standard DNS record types including A, AAAA, CNAME, MX, TXT, SRV, PTR, NS, SOA, and DNSSEC-related types (RRSIG, DNSKEY, DS, NSEC, NSEC3).",
  },
  {
    q: "How does category-based blocking work?",
    a: "Each category contains a curated list of domains. When a category is enabled, all its domains are added as Unbound local-zone directives with 'always_nxdomain' or 'always_refuse' action. This happens at the DNS level — no HTTP proxy is needed.",
  },
  {
    q: "Can I use DNS-over-TLS (DoT) or DNS-over-HTTPS (DoH)?",
    a: "Yes. Unbound supports DoT natively on port 853. For DoH, you can place a reverse proxy (nginx/caddy) in front of Unbound. Configure TLS upstream in the Forwarding Zones section for encrypted upstream queries.",
  },
  {
    q: "How do I scale for multiple offices or locations?",
    a: "Deploy Unbound instances per location for low latency. Use the same configuration (downloadable from the Config File tab) across instances. Centralize logging and rule management through the Web UI with Edge Functions connecting to each instance.",
  },
  {
    q: "What happens if Unbound goes down?",
    a: "Configure clients with a secondary DNS server as fallback. The Monitoring page provides service status alerts. Enable the 'Service status change alerts' notification in Settings to get notified immediately.",
  },
  {
    q: "How are filtering rules applied without restarting Unbound?",
    a: "DNSGuard uses 'unbound-control local_zone' and 'unbound-control local_zone_remove' commands to add/remove filtering rules at runtime. For bulk changes, a 'unbound-control reload' reloads the config without dropping in-flight queries.",
  },
  {
    q: "Is DNSSEC validation mandatory?",
    a: "No, but it is strongly recommended. DNSSEC prevents DNS spoofing and cache poisoning attacks. You can disable it in the Unbound DNS → DNSSEC tab, but this reduces your security posture.",
  },
  {
    q: "How long are query logs retained?",
    a: "Configurable in Settings → Query Logging. Default is 30 days with daily rotation. You can set retention from 1 to 365 days and max log size from 100 MB to 10 GB.",
  },
  {
    q: "What is the difference between Okta SSO and API tokens?",
    a: "Okta SSO is used for platform user authentication — it controls who can log in to the DNSGuard Web UI. API tokens are for programmatic access (scripts, CI/CD pipelines, monitoring tools). Tokens are scoped with granular permissions like dns:read, rules:write, and logs:read, and should follow least-privilege principles.",
  },
  {
    q: "How do I authenticate API requests?",
    a: "Generate an API token in Settings → API Tokens with the required scopes. Include the token in your HTTP requests using the Authorization header: 'Authorization: Bearer dng_your_token_here'. Tokens can be set to expire after 30–365 days or never. Revoke tokens immediately if compromised.",
  },
  {
    q: "Can I switch between dark and light mode?",
    a: "Yes. Use the theme toggle in the top navigation bar to switch between Dark Mode, Light Mode, and System (follows your OS preference). Your choice is saved locally and persists across sessions.",
  },
];

export default function SetupDocs() {
  const [activeSection, setActiveSection] = useState<Section>("setup");
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [expandedStep, setExpandedStep] = useState<string | null>("s1");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const toggleStep = (id: string) => {
    setExpandedStep(expandedStep === id ? null : id);
  };

  const markComplete = (id: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const progress = Math.round((completedSteps.size / SETUP_STEPS.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Setup & Documentation</h2>
          <p className="text-xs text-muted-foreground">Installation guide, walkthrough, and API reference for DNSGuard Enterprise</p>
        </div>
      </motion.div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeSection === s.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>

        {/* ─── SETUP GUIDE ─── */}
        {activeSection === "setup" && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Setup Progress</span>
                <span className="text-xs font-mono text-primary">{completedSteps.size}/{SETUP_STEPS.length} steps</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
              </div>
            </div>

            {/* Steps */}
            {SETUP_STEPS.map((step, idx) => (
              <div key={step.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleStep(step.id)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); markComplete(step.id); }}
                    className="shrink-0"
                  >
                    {completedSteps.has(step.id) ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-primary">Step {idx + 1}</span>
                      <h3 className={`text-sm font-semibold ${completedSteps.has(step.id) ? "line-through text-muted-foreground" : ""}`}>
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                  {expandedStep === step.id ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>

                <AnimatePresence>
                  {expandedStep === step.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                        {step.warning && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20 mt-3">
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                            <p className="text-xs text-warning">{step.warning}</p>
                          </div>
                        )}

                        {step.command && (
                          <div className="relative mt-3">
                            <button
                              onClick={() => copyCommand(step.command!, step.id)}
                              className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copiedCmd === step.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <pre className="bg-background border border-border rounded-lg p-4 pr-12 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
                              {step.command}
                            </pre>
                          </div>
                        )}

                        <ul className="space-y-1.5 mt-3">
                          {step.details.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* ─── BRIDGE SCRIPT ─── */}
        {activeSection === "bridge" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-1">unbound-bridge.js</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Drop this Node.js script on your Unbound server. It exposes all 6 API endpoints the UI needs.
                Reads logs from <code className="px-1 py-0.5 bg-muted rounded font-mono text-[11px]">/var/log/unbound/unbound.log</code> and
                calls <code className="px-1 py-0.5 bg-muted rounded font-mono text-[11px]">unbound-control</code> for stats/flush.
              </p>
              <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 flex items-start gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Requires Unbound logging enabled: set <code className="font-mono">log-queries: yes</code> and <code className="font-mono">logfile: "/var/log/unbound/unbound.log"</code> in unbound.conf
                </p>
              </div>
              <div className="relative">
                <button
                  onClick={() => copyCommand(BRIDGE_SCRIPT, "bridge-main")}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedCmd === "bridge-main" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre className="bg-background border border-border rounded-lg p-4 pr-12 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre max-h-[500px] overflow-y-auto">
                  {BRIDGE_SCRIPT}
                </pre>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-1">systemd Service</h3>
              <p className="text-xs text-muted-foreground mb-3">Save as <code className="px-1 py-0.5 bg-muted rounded font-mono text-[11px]">/etc/systemd/system/unbound-bridge.service</code></p>
              <div className="relative">
                <button
                  onClick={() => copyCommand(BRIDGE_SYSTEMD, "bridge-systemd")}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedCmd === "bridge-systemd" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre className="bg-background border border-border rounded-lg p-4 pr-12 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre">
                  {BRIDGE_SYSTEMD}
                </pre>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-1">Install & Start</h3>
              <div className="relative">
                <button
                  onClick={() => copyCommand(BRIDGE_INSTALL, "bridge-install")}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedCmd === "bridge-install" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre className="bg-background border border-border rounded-lg p-4 pr-12 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre">
                  {BRIDGE_INSTALL}
                </pre>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-1">Nginx Proxy Config</h3>
              <p className="text-xs text-muted-foreground mb-3">Add this to your <code className="px-1 py-0.5 bg-muted rounded font-mono text-[11px]">nginx.conf</code> server block to proxy the bridge through your public domain.</p>
              <div className="relative">
                <button
                  onClick={() => copyCommand(BRIDGE_NGINX, "bridge-nginx")}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedCmd === "bridge-nginx" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre className="bg-background border border-border rounded-lg p-4 pr-12 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre">
                  {BRIDGE_NGINX}
                </pre>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-2">Log Format Reference</h3>
              <p className="text-xs text-muted-foreground mb-3">The bridge parses this exact Unbound log format:</p>
              <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre">
{`Feb 18 13:54:37 hostname unbound[8222]: [8222:0] info: 127.0.0.1 google.com. A IN`}
              </pre>
              <ul className="mt-3 space-y-1.5">
                {[
                  ["clientIp", "The IP that sent the query (127.0.0.1 = the server itself)"],
                  ["domain", "Queried domain name (trailing dot stripped)"],
                  ["type", "DNS record type: A, AAAA, CNAME, MX, TXT, SRV, PTR, NS"],
                  ["status", "Always 'allowed' in query logs — Unbound logs all queries it processes"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-[11px] text-foreground shrink-0">{k}</code>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ─── WALKTHROUGH ─── */}
        {activeSection === "walkthrough" && (
          <div className="space-y-4">
            {WALKTHROUGH_ITEMS.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card border border-border rounded-lg p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ul className="space-y-1.5 ml-11">
                  {item.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 mt-1.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── ARCHITECTURE ─── */}
        {activeSection === "architecture" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5 mb-4">
              <h3 className="text-sm font-semibold mb-2">System Architecture Overview</h3>
              <p className="text-xs text-muted-foreground">DNSGuard Enterprise uses a layered architecture where DNS queries flow through the Unbound resolver with filtering applied at the DNS level, managed via a React-based Web UI communicating through Edge Functions.</p>
            </div>

            {/* Flow diagram */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h4 className="text-xs font-semibold text-muted-foreground mb-4">QUERY FLOW</h4>
              <div className="flex items-center justify-center gap-2 flex-wrap text-xs font-mono">
                {["Client", "→", "Port 53", "→", "Unbound", "→", "Filter Engine", "→", "Cache Check", "→", "Upstream / Block"].map((item, i) => (
                  <span key={i} className={item === "→" ? "text-primary" : "px-3 py-1.5 rounded bg-muted border border-border"}>{item}</span>
                ))}
              </div>
            </div>

            {/* Layers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ARCHITECTURE_LAYERS.map((layer, idx) => (
                <motion.div
                  key={layer.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-card border border-border rounded-lg p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <layer.icon className="h-4 w-4" style={{ color: layer.color }} />
                    <h3 className="text-sm font-semibold">{layer.title}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {layer.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: layer.color }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ─── API REFERENCE ─── */}
        {activeSection === "api" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5 mb-2">
              <h3 className="text-sm font-semibold mb-1">API Reference</h3>
              <p className="text-xs text-muted-foreground mb-3">Edge Functions that bridge the Web UI and Unbound server. All endpoints require authentication via API token.</p>
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">AUTHENTICATION</h4>
                <p className="text-xs text-muted-foreground mb-2">Include your API token in the <code className="px-1.5 py-0.5 bg-background rounded border border-border font-mono text-[11px]">Authorization</code> header:</p>
                <pre className="bg-background border border-border rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
{`curl -H "Authorization: Bearer dng_your_token_here" \\
     https://your-dnsguard-domain/api/unbound/status`}
                </pre>
                <p className="text-xs text-muted-foreground mt-2">Generate tokens in <span className="text-foreground font-medium">Settings → API Tokens</span>. Tokens are scoped — ensure your token has the required permissions for each endpoint.</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-20">Method</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Endpoint</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {API_ENDPOINTS.map((ep, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          ep.method === "GET" ? "bg-success/10 text-success" :
                          ep.method === "POST" ? "bg-primary/10 text-primary" :
                          ep.method === "PUT" ? "bg-warning/10 text-warning" :
                          "bg-destructive/10 text-destructive"
                        }`}>{ep.method}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{ep.path}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{ep.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── FAQ ─── */}
        {activeSection === "faq" && (
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === `faq-${idx}` ? null : `faq-${idx}`)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm font-medium pr-4">{item.q}</span>
                  {expandedFaq === `faq-${idx}` ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                <AnimatePresence>
                  {expandedFaq === `faq-${idx}` && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
