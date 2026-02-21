import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, CheckCircle2, Circle, ChevronDown, ChevronRight,
  Server, Shield, Globe, Database, Key, Settings, Terminal,
  Download, FileText, Cpu, Network, Lock, Zap, AlertTriangle,
  ExternalLink, Copy, Check, Monitor, Layers, HardDrive,
} from "lucide-react";

type Section = "setup" | "bridge" | "walkthrough" | "architecture" | "api" | "okta" | "faq";

const SECTIONS: { id: Section; label: string; icon: any }[] = [
  { id: "setup", label: "Setup Guide", icon: Download },
  { id: "bridge", label: "Bridge Script", icon: Terminal },
  { id: "walkthrough", label: "Walkthrough", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "api", label: "API Reference", icon: Terminal },
  { id: "okta", label: "Okta SSO", icon: Key },
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
    command: `# Step 1 — Generate TLS certificates for unbound-control
sudo unbound-control-setup

# Step 2 — Add this block to /etc/unbound/unbound.conf
#           (paste it before the last closing brace)
remote-control:
    control-enable: yes
    control-interface: 127.0.0.1
    control-port: 8953
    server-key-file: "/etc/unbound/unbound_server.key"
    server-cert-file: "/etc/unbound/unbound_server.pem"
    control-key-file: "/etc/unbound/unbound_control.key"
    control-cert-file: "/etc/unbound/unbound_control.pem"

# Step 3 — Validate config & restart Unbound
sudo unbound-checkconf
sudo systemctl restart unbound

# Step 4 — Verify it works (should print "version: ..." and "status: running")
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
    command: `# IMPORTANT: Add this line to /etc/unbound/unbound.conf (inside server: block)
# so Unbound loads DNSGuard-managed rules from the local.d directory:
#
#     include-toplevel: "/etc/unbound/local.d/*.conf"
#
# Create the directory:
sudo mkdir -p /etc/unbound/local.d

# Validate and restart Unbound after adding the include:
sudo unbound-checkconf
sudo systemctl restart unbound

# DNSGuard bridge will write rules to:
# /etc/unbound/local.d/dnsguard-blacklist.conf
# and auto-reload Unbound via: unbound-control reload`,
    details: [
      "REQUIRED: Add 'include-toplevel: \"/etc/unbound/local.d/*.conf\"' to unbound.conf",
      "The bridge writes local-zone directives (always_refuse) for each blocked domain",
      "Whitelist entries are excluded from the generated block file",
      "Rules sync automatically when you save changes in the DNS Rules page",
      "Unbound is reloaded (not restarted) so rules apply instantly with no downtime",
    ],
    warning: "Without the include-toplevel directive in unbound.conf, rules pushed from the UI will NOT take effect even if the bridge reports success.",
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
    title: "Install Self-Hosted Supabase (Optional)",
    description: "Deploy your own Supabase instance for fully self-hosted settings storage and authentication.",
    command: `# ── Prerequisites ────────────────────────────────────────────────
# Docker & Docker Compose v2 required
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker && sudo systemctl start docker

# ── Clone Supabase Docker repo ──────────────────────────────────
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# ── Configure environment ───────────────────────────────────────
cp .env.example .env

# IMPORTANT: Edit .env and change these values:
#   POSTGRES_PASSWORD=<strong-random-password>
#   JWT_SECRET=<random-string-min-32-chars>
#   ANON_KEY=<generate-from-jwt-secret>
#   SERVICE_ROLE_KEY=<generate-from-jwt-secret>
#   SITE_URL=https://your-dnsguard-domain
#   API_EXTERNAL_URL=https://your-supabase-domain
#
# Generate JWT keys at: https://supabase.com/docs/guides/self-hosting#api-keys

nano .env

# ── Start Supabase ──────────────────────────────────────────────
sudo docker compose up -d

# Verify all containers are running
sudo docker compose ps

# ── Apply DNSGuard migration ────────────────────────────────────
# Download the migration SQL from:
#   DNSGuard → Settings → Backend Mode → Self-Hosted → Export SQL
# Then run it against your Supabase Postgres:
psql "postgresql://postgres:<your-password>@localhost:5432/postgres" \\
     -f dnsguard-migration.sql

# ── Verify the table was created ────────────────────────────────
psql "postgresql://postgres:<your-password>@localhost:5432/postgres" \\
     -c "SELECT count(*) FROM public.user_settings;"`,
    details: [
      "Self-hosted Supabase gives you full control over your data and authentication",
      "Requires Docker and Docker Compose v2 installed on the server",
      "Default Supabase Studio is accessible at http://localhost:8000 (secure with a reverse proxy)",
      "After starting, note your Supabase URL (http://localhost:8000) and Anon Key from .env",
      "In DNSGuard → Settings → Backend Mode, switch to Self-Hosted and enter the URL + Anon Key",
      "Use the 'Export SQL' button to download the migration file needed for the user_settings table",
      "Enable email auth in Supabase Studio → Authentication → Providers if you want Supabase-based login",
      "For production: put Supabase behind nginx/caddy with TLS and restrict Studio access",
    ],
    warning: "Change ALL default passwords and JWT secrets in .env before starting. Never expose Supabase Studio to the public internet without authentication.",
  },
  {
    id: "s8b",
    title: "Configure CORS for Self-Hosted Supabase",
    description: "Allow cross-origin requests so DNSGuard's web UI can reach your self-hosted Supabase API.",
    command: `# ── Option A: Edit Kong config (recommended) ────────────────────
# In your supabase/docker directory:
cd supabase/docker

# Edit the Kong declarative config:
nano volumes/api/kong.yml

# Add the cors plugin to the "api" service's plugins list.
# Find the 'plugins:' block under the route that serves /rest/v1/
# and add:
#
#   - name: cors
#     config:
#       origins:
#         - "https://your-dnsguard-domain.com"
#         - "http://localhost:5173"
#       methods:
#         - GET
#         - POST
#         - PUT
#         - PATCH
#         - DELETE
#         - OPTIONS
#       headers:
#         - Authorization
#         - Content-Type
#         - apikey
#         - x-client-info
#       credentials: true
#       max_age: 3600

# Restart Kong to apply changes:
sudo docker compose restart kong

# ── Option B: Reverse-proxy with nginx (alternative) ───────────
# Serve both DNSGuard UI and Supabase under the same domain
# to avoid CORS entirely:
#
# server {
#     listen 443 ssl;
#     server_name dnsguard.yourdomain.com;
#
#     # DNSGuard frontend
#     location / {
#         proxy_pass http://127.0.0.1:3000;
#     }
#
#     # Supabase API — same origin, no CORS needed
#     location /supabase/ {
#         rewrite ^/supabase/(.*) /\$1 break;
#         proxy_pass http://127.0.0.1:8000;
#         proxy_set_header Host \$host;
#     }
# }

# ── Verify CORS headers ────────────────────────────────────────
curl -i -X OPTIONS \\
  -H "Origin: https://your-dnsguard-domain.com" \\
  -H "Access-Control-Request-Method: GET" \\
  -H "Access-Control-Request-Headers: apikey,authorization,content-type" \\
  http://localhost:8000/rest/v1/

# You should see:
#   Access-Control-Allow-Origin: https://your-dnsguard-domain.com
#   Access-Control-Allow-Methods: GET, POST, ...
#   Access-Control-Allow-Headers: authorization, apikey, ...`,
    details: [
      "CORS is required because the browser blocks requests from one origin (your DNSGuard app) to another (your Supabase API)",
      "Option A edits Kong's declarative config to add the CORS plugin — set origins to your DNSGuard domain",
      "Option B uses nginx as a reverse-proxy so both services share the same domain, eliminating CORS entirely",
      "Replace 'https://your-dnsguard-domain.com' with your actual DNSGuard URL in all configs",
      "For development, you can add 'http://localhost:5173' as an additional allowed origin",
      "If using Option B, update your self-hosted Supabase URL in Settings to the proxied path (e.g. https://dnsguard.yourdomain.com/supabase)",
      "After changes, use the 'Test Connection' button in Settings → Backend Mode to verify it works",
    ],
    warning: "Never use 'Access-Control-Allow-Origin: *' in production. Always restrict origins to your actual DNSGuard domain(s).",
  },
  {
    id: "s9",
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
      "If using self-hosted Supabase: verify settings sync by switching backend mode and saving a change",
    ],
  },
];

const BRIDGE_SCRIPT = `#!/usr/bin/env node
// unbound-bridge.js — DNSGuard API Bridge v1.4
// Place at: /opt/unbound-bridge/unbound-bridge.js
// Run as root: sudo node unbound-bridge.js
// v1.4 — /logs always reads from unbound log file first (log file is the primary source for local mode)

const http = require('http');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const PORT = 8080;

// ── API Authentication ────────────────────────────────────────────────────────
// Set BRIDGE_API_KEY env variable to require Bearer token auth on all requests.
// Example:  BRIDGE_API_KEY=my-secret-key node unbound-bridge.js
// Leave unset to allow unauthenticated access (only do this on a private network).
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || '';

// ── Set this to your Unbound log file path ──────────────────────────────────
// Find it with: grep -i logfile /etc/unbound/unbound.conf
const LOG_FILE = '/var/log/unbound/unbound.log';
// Set true if unbound uses syslog (use-syslog: yes) instead of a file
const USE_JOURNALD = false;

// ─── Auth middleware ──────────────────────────────────────────────────────────
function isAuthorized(req) {
  if (!BRIDGE_API_KEY) return true; // no key configured — allow all
  var auth = req.headers['authorization'] || '';
  return auth === 'Bearer ' + BRIDGE_API_KEY;
}

// ─── CORS / JSON ─────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
function json(res, data, status) {
  cors(res);
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Log parser ───────────────────────────────────────────────────────────────
// Parses multiple Unbound log formats:
// Format 1 (unix-ts bracket): [1771467389] unbound[58080:2] info: 127.0.0.1 google.com. A IN
// Format 2 (iso date):        2024-01-15T13:54:37 unbound[58080:2] info: 127.0.0.1 google.com. A IN
// Format 3 (syslog):          Jan 15 13:54:37 hostname unbound[58080]: [58080:2] info: 127.0.0.1 google.com. A IN
// BLOCKED:  [1771467409] unbound[58080:1] info: facebook.com. always_refuse 127.0.0.1@59952 facebook.com. A IN
// Blocked: always_refuse line (check before allowed to avoid false positives)
const LOG_RE_BLOCKED = /^\\[(\\d+)\\]\\s+unbound\\[\\d+:\\d+\\]\\s+info:\\s+\\S+\\.?\\s+always_refuse\\s+([\\d.:a-fA-F]+)@\\d+\\s+(\\S+?)\\.?\\s+(A|AAAA|CNAME|MX|TXT|SRV|PTR|NS|NULL|HTTPS|SVCB|CAA|NAPTR|SOA|ANY)\\s+IN/;
// Normal query with unix timestamp bracket
const LOG_RE_QUERY   = /^\\[(\\d+)\\]\\s+unbound\\[\\d+:\\d+\\]\\s+info:\\s+([\\d.:a-fA-F]+)\\s+(\\S+?)\\.?\\s+(A|AAAA|CNAME|MX|TXT|SRV|PTR|NS|NULL|HTTPS|SVCB|CAA|NAPTR|SOA|ANY)\\s+IN/;
// Normal query with ISO timestamp (when log-time-ascii: yes is set in unbound.conf)
const LOG_RE_ISO     = /^([\\d\\-T:]+Z?)\\s+unbound\\[\\d+:\\d+\\]\\s+info:\\s+([\\d.:a-fA-F]+)\\s+(\\S+?)\\.?\\s+(A|AAAA|CNAME|MX|TXT|SRV|PTR|NS|NULL|HTTPS|SVCB|CAA|NAPTR|SOA|ANY)\\s+IN/;
// Syslog format: Feb 21 06:13:04 hostname unbound[pid]: [pid:tid] info: ip domain. TYPE IN [RCODE time cached size]
// Also supports "unbound:" without PID bracket
// Response line (has RCODE + response time + cached flag + size) — prefer these over query-only lines
const LOG_RE_SYSLOG_RESP = /^(\\w{3}\\s+\\d+\\s+[\\d:]+)\\s+\\S+\\s+unbound(?:\\[\\d+\\])?:\\s+\\[\\d+:\\d+\\]\\s+info:\\s+([\\d.:a-fA-F]+)\\s+(\\S+?)\\.?\\s+(A|AAAA|CNAME|MX|TXT|SRV|PTR|NS|NULL|HTTPS|SVCB|CAA|NAPTR|SOA|ANY)\\s+IN\\s+(\\w+)\\s+([\\d.]+)\\s+(\\d+)\\s+(\\d+)/;
// Query-only line (no RCODE) — used as fallback when no response line follows
const LOG_RE_SYSLOG  = /^(\\w{3}\\s+\\d+\\s+[\\d:]+)\\s+\\S+\\s+unbound(?:\\[\\d+\\])?:\\s+\\[\\d+:\\d+\\]\\s+info:\\s+([\\d.:a-fA-F]+)\\s+(\\S+?)\\.?\\s+(A|AAAA|CNAME|MX|TXT|SRV|PTR|NS|NULL|HTTPS|SVCB|CAA|NAPTR|SOA|ANY)\\s+IN\\s*$/;

let logIndex = 0;
function parseLogLine(line) {
  // 1. Check for blocked (always_refuse) — most specific first
  // Groups: m[1]=unix_ts, m[2]=clientIp, m[3]=domain, m[4]=type
  let m = line.match(LOG_RE_BLOCKED);
  if (m) {
    const ts = new Date(parseInt(m[1]) * 1000);
    return {
      id: 'log-' + ts.getTime() + '-' + (logIndex++),
      timestamp: ts.toISOString(),
      clientIp: m[2],
      domain: m[3].replace(/\\.$/, ''),
      type: m[4],
      status: 'blocked',
      responseTime: 0,
    };
  }
  // 2. Normal query line with unix timestamp bracket
  // Groups: m[1]=unix_ts, m[2]=clientIp, m[3]=domain, m[4]=type
  m = line.match(LOG_RE_QUERY);
  if (m) {
    const ts = new Date(parseInt(m[1]) * 1000);
    return {
      id: 'log-' + ts.getTime() + '-' + (logIndex++),
      timestamp: ts.toISOString(),
      clientIp: m[2],
      domain: m[3].replace(/\\.$/, ''),
      type: m[4],
      status: 'allowed',
      responseTime: 0,
    };
  }
  // 3. ISO timestamp format (log-time-ascii: yes in unbound.conf)
  // Groups: m[1]=iso_ts, m[2]=clientIp, m[3]=domain, m[4]=type
  m = line.match(LOG_RE_ISO);
  if (m) {
    const ts = new Date(m[1]);
    if (isNaN(ts.getTime())) return null;
    return {
      id: 'log-' + ts.getTime() + '-' + (logIndex++),
      timestamp: ts.toISOString(),
      clientIp: m[2],
      domain: m[3].replace(/\\.$/, ''),
      type: m[4],
      status: 'allowed',
      responseTime: 0,
    };
  }
  // 4. Syslog response line (has RCODE, responseTime, cached, size)
  // Groups: m[1]=syslog_ts, m[2]=clientIp, m[3]=domain, m[4]=type, m[5]=rcode, m[6]=responseTime, m[7]=cached, m[8]=size
  m = line.match(LOG_RE_SYSLOG_RESP);
  if (m) {
    const ts = new Date(m[1] + ' ' + new Date().getFullYear());
    if (isNaN(ts.getTime())) return null;
    return {
      id: 'log-' + ts.getTime() + '-' + (logIndex++),
      timestamp: ts.toISOString(),
      clientIp: m[2],
      domain: m[3].replace(/\\.$/, ''),
      type: m[4],
      status: m[5] === 'REFUSED' ? 'blocked' : 'allowed',
      responseTime: Math.round(parseFloat(m[6]) * 1000),
    };
  }
  // 5. Syslog query-only line (no RCODE) — fallback
  // Groups: m[1]=syslog_ts, m[2]=clientIp, m[3]=domain, m[4]=type
  m = line.match(LOG_RE_SYSLOG);
  if (m) {
    const ts = new Date(m[1] + ' ' + new Date().getFullYear());
    if (isNaN(ts.getTime())) return null;
    return {
      id: 'log-' + ts.getTime() + '-' + (logIndex++),
      timestamp: ts.toISOString(),
      clientIp: m[2],
      domain: m[3].replace(/\\.$/, ''),
      type: m[4],
      status: 'allowed',
      responseTime: 0,
    };
  }
  return null;
}

function readLogsFromFile(limit) {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.trim().split('\\n').slice(-5000); // read last 5000 lines
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
    const out = execSync('journalctl -u unbound -n 1000 --no-pager --output=short', { timeout: 5000 }).toString();
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

// Debug: return raw log lines and parse results for troubleshooting
function getLogDebug() {
  try {
    var exists = fs.existsSync(LOG_FILE);
    if (!exists) return { error: 'Log file not found: ' + LOG_FILE, logFile: LOG_FILE, useJournald: USE_JOURNALD };
    var stat = fs.statSync(LOG_FILE);
    var content = fs.readFileSync(LOG_FILE, 'utf8');
    var lines = content.trim().split('\\n');
    var lastLines = lines.slice(-20);
    var parsed = lastLines.map(function(line) { return { line: line, parsed: parseLogLine(line) }; });
    var totalParsed = 0;
    lines.slice(-200).forEach(function(l) { if (parseLogLine(l)) totalParsed++; });
    return { logFile: LOG_FILE, exists: exists, sizeBytes: stat.size, totalLines: lines.length, parsedInLast200: totalParsed, useJournald: USE_JOURNALD, last20Lines: parsed };
  } catch(e) { return { error: e.message, logFile: LOG_FILE }; }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function runUnboundControl(args, cb) {
  exec('unbound-control ' + args, function(err, stdout) {
    if (!err) return cb(null, stdout);
    exec('sudo unbound-control ' + args, function(err2, stdout2) {
      cb(err2, stdout2 || '');
    });
  });
}

function getStats() {
  return new Promise(function(resolve) {
    runUnboundControl('stats_noreset', function(err, stdout) {
      if (err || !stdout) {
        // Return empty stats — UI degrades gracefully instead of returning HTTP 500
        return resolve({ _unbound_control_error: err ? err.message : 'empty output' });
      }
      var raw = {};
      stdout.split('\\n').forEach(function(line) {
        var eq = line.indexOf('=');
        if (eq !== -1) raw[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
      });
      resolve(raw);
    });
  });
}

// ─── System Info ─────────────────────────────────────────────────────────────
function getInfo() {
  // CPU usage (average across all cores, sampled over 100ms)
  var cpus = os.cpus();
  var cpuUsage = 0;
  try {
    var t1 = cpus.map(function(c) { return c.times; });
    // Blocking sleep 100ms for a delta sample
    var end = Date.now() + 100;
    while (Date.now() < end) {}
    var cpus2 = os.cpus();
    var idle = 0, total = 0;
    cpus2.forEach(function(c, i) {
      var dt = Object.keys(c.times).reduce(function(s, k) { return s + c.times[k] - t1[i][k]; }, 0);
      idle += c.times.idle - t1[i].idle;
      total += dt;
    });
    cpuUsage = total > 0 ? Math.round((1 - idle / total) * 100) : 0;
  } catch(e) { cpuUsage = 0; }

  // Memory
  var totalMem = os.totalmem();
  var freeMem = os.freemem();
  var memPct = Math.round((1 - freeMem / totalMem) * 100);

  // Disk usage via df
  var diskPct = 0;
  try {
    var dfOut = execSync('df -h / --output=pcent 2>/dev/null | tail -1', { timeout: 3000 }).toString().trim().replace('%','');
    diskPct = parseInt(dfOut) || 0;
  } catch(e) {}

  // Network traffic (bytes/sec) via /proc/net/dev
  var networkIn = 0, networkOut = 0;
  try {
    var netDev = fs.readFileSync('/proc/net/dev', 'utf8');
    var lines = netDev.trim().split('\\n').slice(2);
    lines.forEach(function(line) {
      var parts = line.trim().split(/\\s+/);
      var iface = parts[0].replace(':', '');
      if (iface !== 'lo') {
        networkIn += parseInt(parts[1]) || 0;   // receive bytes
        networkOut += parseInt(parts[9]) || 0;  // transmit bytes
      }
    });
    // Convert to MB/s (snapshot, not delta — divide by uptime for rough average)
    var uptime = os.uptime();
    networkIn = parseFloat((networkIn / uptime / 1024 / 1024).toFixed(2));
    networkOut = parseFloat((networkOut / uptime / 1024 / 1024).toFixed(2));
  } catch(e) {}

  // Hostname, OS
  var hostname = os.hostname();
  var osName = '';
  try { osName = execSync('lsb_release -sd 2>/dev/null || uname -sr', { timeout: 2000 }).toString().trim().replace(/"/g,''); } catch(e) { osName = os.type() + ' ' + os.release(); }

  // Unbound version
  var version = '';
  try { version = execSync('unbound -V 2>&1 | head -1', { timeout: 2000 }).toString().trim(); } catch(e) { version = 'unknown'; }

  // Network addresses
  var ipAddress = '', netmask = '', macAddress = '', dnsInterface = '';
  var ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(function(iface) {
    if (iface === 'lo') return;
    (ifaces[iface] || []).forEach(function(addr) {
      if (addr.family === 'IPv4' && !ipAddress) {
        ipAddress = addr.address;
        netmask = addr.netmask;
        macAddress = addr.mac;
        dnsInterface = iface;
      }
    });
  });

  // Gateway
  var gateway = '';
  try { gateway = execSync("ip route | awk '/default/ {print $3}' | head -1", { timeout: 2000 }).toString().trim(); } catch(e) {}

  // Public IP
  var publicIp = '';
  try { publicIp = execSync('curl -s --max-time 3 https://api.ipify.org 2>/dev/null || echo ""', { timeout: 5000 }).toString().trim(); } catch(e) {}

  // DNS port & API port from unbound.conf
  var dnsPort = 53, apiPort = 8080;
  try {
    var confTxt = fs.readFileSync('/etc/unbound/unbound.conf', 'utf8');
    var pm = confTxt.match(/port:\\s*(\\d+)/);
    if (pm) dnsPort = parseInt(pm[1]);
  } catch(e) {}

  return {
    status: 'running',
    hostname: hostname,
    version: version,
    resolver: 'Unbound',
    os: osName,
    cpu: cpuUsage,
    memory: memPct,
    disk: diskPct,
    networkIn: networkIn,
    networkOut: networkOut,
    ipAddress: ipAddress,
    publicIp: publicIp,
    netmask: netmask,
    gateway: gateway,
    macAddress: macAddress,
    dnsInterface: dnsInterface,
    dnsPort: dnsPort,
    apiPort: apiPort,
  };
}

// ─── Cache flush ──────────────────────────────────────────────────────────────
function flushCache() {
  return new Promise(function(resolve) {
    runUnboundControl('flush_zone .', function(err) {
      if (err) return resolve({ ok: false, message: 'flush_zone failed: ' + err.message + '. Run: sudo unbound-control-setup && sudo systemctl restart unbound' });
      resolve({ ok: true, message: 'Cache flushed successfully' });
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

// ─── Apply Rules to Unbound ───────────────────────────────────────────────────
// Writes /etc/unbound/local.d/dnsguard-blacklist.conf and reloads Unbound.
// Blacklisted domains → always_refuse; whitelisted domains are excluded from blocking.
function applyRules(rules) {
  return new Promise(function(resolve) {
    try {
      var whitelist = (rules.whitelist || [])
        .filter(function(r) { return r.enabled; })
        .map(function(r) { return r.domain.replace(/^\\*\\./, '').toLowerCase(); });

      var blocked = {};

      (rules.blacklist || []).forEach(function(r) {
        if (!r.enabled) return;
        var d = r.domain.replace(/^\\*\\./, '').toLowerCase();
        if (whitelist.indexOf(d) === -1) blocked[d] = true;
      });

      (rules.categories || []).forEach(function(cat) {
        if (!cat.enabled) return;
        (cat.domains || []).forEach(function(domain) {
          var d = domain.replace(/^\\*\\./, '').toLowerCase();
          if (whitelist.indexOf(d) === -1) blocked[d] = true;
        });
      });

      var lines = ['# DNSGuard managed rules — do not edit manually', '# Generated: ' + new Date().toISOString(), ''];
      Object.keys(blocked).forEach(function(domain) {
        lines.push('local-zone: "' + domain + '" always_refuse');
      });

      var confPath = '/etc/unbound/local.d/dnsguard-blacklist.conf';
      fs.mkdirSync('/etc/unbound/local.d', { recursive: true });
      fs.writeFileSync(confPath, lines.join('\\n') + '\\n', 'utf8');

      runUnboundControl('reload', function(err) {
        if (err) {
          return resolve({ ok: false, message: 'Rules written (' + Object.keys(blocked).length + ' domains) but reload failed: ' + err.message });
        }
        resolve({ ok: true, message: 'Applied ' + Object.keys(blocked).length + ' blocked domains, Unbound reloaded' });
      });
    } catch(e) {
      resolve({ ok: false, message: 'Rules error: ' + e.message });
    }
  });
}

// ─── Logs Summary (for dashboard hourly chart + top blocked) ─────────────────
// Reads last 24h of logs and returns per-hour counts + top blocked domains.
function getLogsSummary() {
  try {
    var allLogs = USE_JOURNALD ? readLogsFromJournald(10000) : (function() {
      var content = fs.readFileSync(LOG_FILE, 'utf8');
      var lines = content.trim().split('\\n');
      var entries = [];
      lines.forEach(function(line) { var e = parseLogLine(line); if (e) entries.push(e); });
      return entries;
    })();

    var now = Date.now();
    var cutoff = now - 24 * 60 * 60 * 1000;

    // Build hourly buckets for last 24h
    var hours = {};
    for (var i = 0; i < 24; i++) {
      var d = new Date(now - (23 - i) * 3600 * 1000);
      var key = d.getUTCHours().toString().padStart(2,'0') + ':00';
      hours[key] = { hour: key, allowed: 0, blocked: 0 };
    }

    // Tally blocked domains
    var blockedMap = {};
    var totalAllowed = 0, totalBlocked = 0;

    allLogs.forEach(function(e) {
      var ts = new Date(e.timestamp).getTime();
      if (ts < cutoff) return;
      var h = new Date(ts);
      var key = h.getUTCHours().toString().padStart(2,'0') + ':00';
      if (hours[key]) {
        if (e.status === 'blocked') {
          hours[key].blocked++;
          totalBlocked++;
          blockedMap[e.domain] = (blockedMap[e.domain] || 0) + 1;
        } else {
          hours[key].allowed++;
          totalAllowed++;
        }
      }
    });

    // Top blocked domains sorted by count
    var topBlocked = Object.keys(blockedMap)
      .map(function(d) { return { domain: d, count: blockedMap[d] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, 10);

    return {
      hourly: Object.values(hours),
      topBlocked: topBlocked,
      totalAllowed: totalAllowed,
      totalBlocked: totalBlocked,
    };
  } catch(e) {
    return { hourly: [], topBlocked: [], totalAllowed: 0, totalBlocked: 0, error: e.message };
  }
}

// ─── Settings (GET + POST /settings) ─────────────────────────────────────────
// Persists all UI settings to the configured database (SQLite or PostgreSQL).
// SQLite: /var/lib/dnsguard/dnsguard.db — table: app_settings (key TEXT PK, value TEXT)
// PostgreSQL: table app_settings (key TEXT PRIMARY KEY, value TEXT)

var SETTINGS_FILE = process.env.SETTINGS_FILE || '/var/lib/dnsguard/settings.json';

// Ensure the settings table exists in SQLite
function ensureSettingsTableSQLite(db) {
  db.prepare('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
}

// Ensure the settings table exists in PostgreSQL
function ensureSettingsTablePg(client) {
  return client.query(
    'CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  );
}

// Read all settings as a plain object from the DB or fallback JSON file
function readSettings(dbType, pgClientFn) {
  if (dbType === 'remote' && pgClientFn) {
    // Handled async — return a Promise
    var client = pgClientFn();
    return client.connect().then(function() {
      return ensureSettingsTablePg(client);
    }).then(function() {
      return client.query('SELECT key, value FROM app_settings');
    }).then(function(result) {
      client.end();
      var obj = {};
      result.rows.forEach(function(r) {
        try { obj[r.key] = JSON.parse(r.value); } catch(e) { obj[r.key] = r.value; }
      });
      return obj;
    }).catch(function(err) {
      client.end().catch(function(){});
      throw err;
    });
  }
  // Local SQLite
  try {
    var path = require('path');
    var Database = require(path.join(__dirname, 'node_modules', 'better-sqlite3'));
    var DB_PATH = process.env.DB_PATH || '/var/lib/dnsguard/dnsguard.db';
    fs.mkdirSync(require('path').dirname(DB_PATH), { recursive: true });
    var db = new Database(DB_PATH);
    ensureSettingsTableSQLite(db);
    var rows = db.prepare('SELECT key, value FROM app_settings').all();
    db.close();
    var obj = {};
    rows.forEach(function(r) {
      try { obj[r.key] = JSON.parse(r.value); } catch(e) { obj[r.key] = r.value; }
    });
    return Promise.resolve(obj);
  } catch(e) {
    // Fallback: JSON file (no SQLite driver installed)
    try {
      fs.mkdirSync(require('path').dirname(SETTINGS_FILE), { recursive: true });
      var raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return Promise.resolve(JSON.parse(raw));
    } catch(fe) {
      return Promise.resolve({});
    }
  }
}

// Write settings object to DB — merges with existing values (upsert per key)
function writeSettings(updates, dbType, pgClientFn) {
  if (dbType === 'remote' && pgClientFn) {
    var client = pgClientFn();
    return client.connect().then(function() {
      return ensureSettingsTablePg(client);
    }).then(function() {
      var queries = Object.keys(updates).map(function(key) {
        return client.query(
          'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [key, JSON.stringify(updates[key])]
        );
      });
      return Promise.all(queries);
    }).then(function() {
      client.end();
      return { ok: true };
    }).catch(function(err) {
      client.end().catch(function(){});
      throw err;
    });
  }
  // Local SQLite
  try {
    var path = require('path');
    var Database = require(path.join(__dirname, 'node_modules', 'better-sqlite3'));
    var DB_PATH = process.env.DB_PATH || '/var/lib/dnsguard/dnsguard.db';
    fs.mkdirSync(require('path').dirname(DB_PATH), { recursive: true });
    var db = new Database(DB_PATH);
    ensureSettingsTableSQLite(db);
    var stmt = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');
    var insertMany = db.transaction(function(entries) {
      entries.forEach(function(e) { stmt.run(e.key, JSON.stringify(e.value)); });
    });
    insertMany(Object.keys(updates).map(function(k) { return { key: k, value: updates[k] }; }));
    db.close();
    return Promise.resolve({ ok: true });
  } catch(e) {
    // Fallback: JSON file
    try {
      fs.mkdirSync(require('path').dirname(SETTINGS_FILE), { recursive: true });
      var existing = {};
      try { existing = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch(fe) {}
      Object.assign(existing, updates);
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(existing, null, 2), 'utf8');
      return Promise.resolve({ ok: true });
    } catch(fe) {
      return Promise.reject(new Error('Settings write failed: ' + fe.message));
    }
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
var server = http.createServer(function(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ── Authenticate ──────────────────────────────────────────────────────────
  if (!isAuthorized(req)) {
    cors(res);
    res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="unbound-bridge"' });
    res.end(JSON.stringify({ error: 'Unauthorized — set Authorization: Bearer <BRIDGE_API_KEY>' }));
    return;
  }

  var url = new URL(req.url, 'http://localhost:' + PORT);
  // ── DB config from request headers (set by UI based on Settings → Database) ──
  var dbType     = req.headers['x-db-type'] || 'local';
  var dbHost     = req.headers['x-db-host'] || null;
  var dbPort     = parseInt(req.headers['x-db-port'] || '5432', 10);
  var dbName     = req.headers['x-db-name'] || null;
  var dbUser     = req.headers['x-db-user'] || null;
  var dbPassword = req.headers['x-db-password'] || null;
  // Helper: get a pg client using the request-supplied credentials
  function getRemoteDbClient() {
    var path = require('path');
    var { Client } = require(path.join(__dirname, 'node_modules', 'pg'));
    return new Client({
      host: dbHost, port: dbPort, database: dbName || 'dnsguard',
      user: dbUser, password: dbPassword, connectionTimeoutMillis: 7000,
    });
  }

  Promise.resolve().then(function() {
    if (req.method === 'GET' && url.pathname === '/stats')
      return getStats().then(function(d) { json(res, d); });
    if (req.method === 'GET' && url.pathname === '/info')
      return json(res, getInfo());
    if (req.method === 'GET' && url.pathname === '/logs') {
      var limit = parseInt(url.searchParams.get('limit') || '50');
      if (dbType === 'remote' && dbHost) {
        // Query remote PostgreSQL for logs
        var pgClient = getRemoteDbClient();
        return pgClient.connect().then(function() {
          return pgClient.query(
            'SELECT id::text, timestamp, client_ip as "clientIp", domain, type, status, response_time as "responseTime" FROM query_log ORDER BY timestamp DESC LIMIT $1',
            [limit]
          );
        }).then(function(result) {
          pgClient.end();
          return json(res, result.rows);
        }).catch(function(err) {
          pgClient.end();
          return json(res, { error: err.message }, 502);
        });
      }
      if (dbType === 'local') {
        // Primary source: parse the Unbound log file directly.
        // SQLite query_log is only used if rows exist (populated by an external ingestion job).
        var fileLogs = readLogs(limit);
        if (fileLogs.length > 0) return json(res, fileLogs);
        // Fallback: try SQLite query_log table (populated externally)
        try {
          var path2 = require('path');
          var Database2 = require(path2.join(__dirname, 'node_modules', 'better-sqlite3'));
          var DB_PATH2 = process.env.DB_PATH || '/var/lib/dnsguard/dnsguard.db';
          var db2 = new Database2(DB_PATH2, { readonly: true });
          var rows = db2.prepare('SELECT id, timestamp, client_ip as clientIp, domain, type, status, response_time as responseTime FROM query_log ORDER BY timestamp DESC LIMIT ?').all(limit);
          db2.close();
          if (rows.length > 0) return json(res, rows);
        } catch(e) { /* SQLite not available or table missing — already returned file logs above */ }
        return json(res, []);
      }
      return json(res, readLogs(limit));
    }
    if (req.method === 'GET' && url.pathname === '/logs/debug')
      return json(res, getLogDebug());
    if (req.method === 'GET' && url.pathname === '/logs/summary')
      return json(res, getLogsSummary());
    if (req.method === 'GET' && url.pathname === '/query')
      return dnsQuery(url.searchParams.get('domain') || 'google.com', url.searchParams.get('type') || 'A').then(function(d) { json(res, d); });
    if (req.method === 'GET' && url.pathname === '/ping')
      return pingServers().then(function(d) { json(res, d); });
    if (req.method === 'POST' && url.pathname === '/cache/flush')
      return flushCache().then(function(d) { json(res, d); });
    if (req.method === 'POST' && url.pathname === '/rules') {
      var body = '';
      req.on('data', function(d) { body += d; });
      req.on('end', function() {
        try {
          var rules = JSON.parse(body);
          applyRules(rules).then(function(result) { json(res, result); });
        } catch(e) {
          json(res, { ok: false, message: 'Invalid JSON: ' + e.message }, 400);
        }
      });
      return;
    }
    // ── /db/ping ─ v1.2+ ───────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/db/ping') {
      var body = '';
      req.on('data', function(d) { body += d; });
      req.on('end', function() {
        try {
          var cfg = JSON.parse(body || '{}');
        } catch(e) {
          return json(res, { error: 'Invalid JSON' }, 400);
        }
        var start = Date.now();
        // Local SQLite ping
        if (!cfg.host || cfg.type === 'local') {
          try {
            var path = require('path');
            var Database = require(path.join(__dirname, 'node_modules', 'better-sqlite3'));
            var DB_PATH = process.env.DB_PATH || '/var/lib/dnsguard/dnsguard.db';
            var db = new Database(DB_PATH, { readonly: true });
            db.prepare('SELECT 1').get();
            db.close();
            return json(res, { ok: true, type: 'local', latencyMs: Date.now() - start, path: DB_PATH });
          } catch(e) {
            return json(res, { ok: false, error: e.message }, 502);
          }
        }
        // Remote PostgreSQL ping
        var path = require('path');
        var { Client } = require(path.join(__dirname, 'node_modules', 'pg'));
        var client = new Client({
          host:     cfg.host,
          port:     parseInt(cfg.port, 10) || 5432,
          database: cfg.database || 'dnsguard',
          user:     cfg.user,
          password: cfg.password,
          connectionTimeoutMillis: 7000,
          ssl:      cfg.sslmode && cfg.sslmode !== 'disable' ? { rejectUnauthorized: cfg.sslmode === 'verify-full' } : false,
        });
        client.connect(function(err) {
          if (err) {
            return json(res, { ok: false, error: err.message }, 502);
          }
          client.query('SELECT version()', function(qerr, result) {
            client.end();
            if (qerr) return json(res, { ok: false, error: qerr.message }, 502);
            var version = result.rows[0] ? result.rows[0].version : 'unknown';
            json(res, { ok: true, type: 'remote', latencyMs: Date.now() - start, host: cfg.host, port: cfg.port || 5432, version: version });
          });
        });
      });
      return;
    }
    // ── GET /settings — return all persisted app settings ────────────────────
    if (req.method === 'GET' && url.pathname === '/settings') {
      return readSettings(dbType, dbHost ? getRemoteDbClient : null)
        .then(function(settings) { json(res, settings); })
        .catch(function(err) { json(res, { error: err.message }, 502); });
    }
    // ── POST /settings — merge and persist app settings ───────────────────────
    if (req.method === 'POST' && url.pathname === '/settings') {
      var body = '';
      req.on('data', function(d) { body += d; });
      req.on('end', function() {
        var updates;
        try { updates = JSON.parse(body || '{}'); } catch(e) {
          return json(res, { error: 'Invalid JSON: ' + e.message }, 400);
        }
        writeSettings(updates, dbType, dbHost ? getRemoteDbClient : null)
          .then(function() { json(res, { ok: true }); })
          .catch(function(err) { json(res, { error: err.message }, 502); });
      });
      return;
    }
    json(res, { error: 'Not found' }, 404);
  }).catch(function(err) { json(res, { error: err.message }, 500); });
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('[unbound-bridge] listening on http://0.0.0.0:' + PORT);
  console.log('[unbound-bridge] log source: ' + (USE_JOURNALD ? 'journald' : LOG_FILE));
  console.log('[unbound-bridge] auth: ' + (BRIDGE_API_KEY ? 'Bearer token ENABLED' : 'DISABLED — set BRIDGE_API_KEY env var to secure'));
});`;

const BRIDGE_SYSTEMD = `[Unit]
Description=DNSGuard Unbound Bridge
After=network.target unbound.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /opt/unbound-bridge/unbound-bridge.js
# ── Set your API key here to secure the bridge ──────────────────────────────
Environment=BRIDGE_API_KEY=change-me-use-a-long-random-string
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target`;

const BRIDGE_INSTALL = `# Create directory and copy script
sudo mkdir -p /opt/unbound-bridge
sudo cp unbound-bridge.js /opt/unbound-bridge/

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Initialise npm and install dependencies
cd /opt/unbound-bridge
sudo npm init -y

# REQUIRED: SQLite driver for /settings and /db/ping support
# All settings are persisted to: /var/lib/dnsguard/dnsguard.db
sudo npm install better-sqlite3

# OPTIONAL: PostgreSQL driver (only if using Remote Database mode)
sudo npm install pg

# Create the data directory for the SQLite database
sudo mkdir -p /var/lib/dnsguard
sudo chown root:root /var/lib/dnsguard

# Install systemd service
sudo cp unbound-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable unbound-bridge
sudo systemctl start unbound-bridge

# Verify it's running
sudo systemctl status unbound-bridge

# Test bridge is up
curl -H "Authorization: Bearer change-me-use-a-long-random-string" \\
     http://localhost:8080/stats | head -5

# Test GET /settings (should return {} on first run)
curl -s -H "Authorization: Bearer change-me-use-a-long-random-string" \\
     http://localhost:8080/settings | python3 -m json.tool

# Test POST /settings (saves to /var/lib/dnsguard/dnsguard.db)
curl -s -X POST http://localhost:8080/settings \\
     -H "Authorization: Bearer change-me-use-a-long-random-string" \\
     -H "Content-Type: application/json" \\
     -d '{"bridge_url":"http://localhost:8080","log_retention":"30"}' | python3 -m json.tool

# Verify it was persisted
curl -s -H "Authorization: Bearer change-me-use-a-long-random-string" \\
     http://localhost:8080/settings | python3 -m json.tool`;

const BRIDGE_NGINX = `# Add inside your server {} block in nginx.conf
# This proxies /api/* to the bridge and passes the Authorization header.
location /api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Authorization $http_authorization;
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization";
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
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("setup-completed-steps");
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
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
      localStorage.setItem("setup-completed-steps", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const copyCommand = async (cmd: string, id: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(cmd);
      } else {
        throw new Error("clipboard unavailable");
      }
    } catch {
      // Fallback for HTTP / iframe contexts
      const el = document.createElement("textarea");
      el.value = cmd;
      el.setAttribute("readonly", "");
      el.style.cssText = "position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;";
      document.body.appendChild(el);
      el.focus({ preventScroll: true });
      el.setSelectionRange(0, el.value.length);
      document.execCommand("copy");
      document.body.removeChild(el);
    }
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
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-start gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive space-y-1">
                  <p className="font-semibold">If Stats or Cache Flush return HTTP 500, or Rules Sync returns HTTP 404:</p>
                  <p>Copy this updated script, replace your bridge file, then run:</p>
                  <code className="block bg-destructive/10 rounded px-2 py-1 font-mono mt-1">sudo cp unbound-bridge.js /opt/unbound-bridge/<br/>sudo systemctl restart unbound-bridge</code>
                  <p className="mt-1">If Stats/Cache Flush still fail, enable remote-control: <code className="font-mono">sudo unbound-control-setup && sudo systemctl restart unbound</code></p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 flex items-start gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Requires Unbound logging enabled: set <code className="font-mono">log-queries: yes</code> and <code className="font-mono">logfile: "/var/log/unbound/unbound.log"</code> in unbound.conf
                </p>
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    const blob = new Blob([BRIDGE_SCRIPT], { type: "text/javascript" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "unbound-bridge.js";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download unbound-bridge.js
                </button>
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

            {/* ── Fix Stats HTTP 500 ── */}
            <div className="bg-card border border-destructive/30 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <h3 className="text-sm font-semibold text-destructive">Fixing Stats / Cache Flush HTTP 500</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                These endpoints fail when <code className="px-1 py-0.5 bg-muted rounded font-mono text-[11px]">unbound-control</code> can't
                connect because remote-control is not configured in <code className="px-1 py-0.5 bg-muted rounded font-mono text-[11px]">unbound.conf</code>.
                Follow these steps in order:
              </p>
              <div className="space-y-3">
                {([
                  { label: "1. Generate TLS certificates", cmd: "sudo unbound-control-setup", id: "fix-1" },
                  {
                    label: "2. Add this block to /etc/unbound/unbound.conf",
                    cmd: [
                      "remote-control:",
                      "    control-enable: yes",
                      "    control-interface: 127.0.0.1",
                      "    control-port: 8953",
                      '    server-key-file: "/etc/unbound/unbound_server.key"',
                      '    server-cert-file: "/etc/unbound/unbound_server.pem"',
                      '    control-key-file: "/etc/unbound/unbound_control.key"',
                      '    control-cert-file: "/etc/unbound/unbound_control.pem"',
                    ].join("\n"),
                    id: "fix-2",
                  },
                  { label: "3. Validate config and restart Unbound", cmd: "sudo unbound-checkconf && sudo systemctl restart unbound", id: "fix-3" },
                  { label: "4. Verify unbound-control works", cmd: "sudo unbound-control status", id: "fix-4" },
                  { label: "5. Redeploy bridge script (copy from above, then run)", cmd: "sudo cp unbound-bridge.js /opt/unbound-bridge/ && sudo systemctl restart unbound-bridge", id: "fix-5" },
                ] as { label: string; cmd: string; id: string }[]).map(({ label, cmd, id }) => (
                  <div key={id}>
                    <p className="text-xs font-medium text-foreground mb-1">{label}</p>
                    <div className="relative">
                      <button
                        onClick={() => copyCommand(cmd, id)}
                        className="absolute top-1.5 right-1.5 z-10 p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedCmd === id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <pre className="bg-background border border-border rounded-lg p-3 pr-8 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {cmd}
                      </pre>
                    </div>
                  </div>
                ))}
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
                  ["status", "'allowed' for normal queries, 'blocked' when Unbound logs always_refuse action"],
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

        {/* ─── Okta SSO ─── */}
        {activeSection === "okta" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <Key className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">Okta SSO Integration</h2>
                <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">Enterprise</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                DNSGuard uses <strong className="text-foreground">Okta</strong> as the sole identity provider — there is no separate user registration. This guide walks through creating the OIDC app in Okta, configuring it in DNSGuard, assigning users/groups, enabling MFA, and verifying the integration.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Shield, title: "No Local Accounts", desc: "All user identities live in Okta. DNSGuard trusts Okta-issued tokens." },
                  { icon: Lock, title: "OIDC / OAuth 2.0", desc: "Standard OpenID Connect Authorization Code flow with PKCE." },
                  { icon: Globe, title: "Group-Based Access", desc: "Map Okta groups to DNSGuard roles: Admin, Operator, Viewer." },
                ].map((c) => (
                  <div key={c.title} className="flex flex-col gap-2 p-4 rounded-lg bg-muted/40 border border-border">
                    <c.icon className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {([
              {
                num: "01", title: "Create an Okta Application", stepIcon: Globe,
                body: (<div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>In <strong className="text-foreground">Okta Admin Console</strong> go to <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">Applications → Applications → Create App Integration</code>.</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs">
                    <li>Select <strong className="text-foreground">OIDC – OpenID Connect</strong>, then <strong className="text-foreground">Web Application</strong>, click <em>Next</em>.</li>
                    <li>Name the app <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">DNSGuard</code> and enable <em>Authorization Code</em> grant type.</li>
                    <li>Sign-in redirect URI: <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">https://your-dnsguard-domain/auth/callback</code></li>
                    <li>Sign-out redirect URI: <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">https://your-dnsguard-domain/</code></li>
                    <li>Under Assignments, select <em>Limit access to selected groups</em> and add your DNS admin group.</li>
                    <li>Save — copy the <strong className="text-foreground">Client ID</strong> and <strong className="text-foreground">Client Secret</strong>.</li>
                  </ol>
                </div>),
              },
              {
                num: "02", title: "Configure DNSGuard Settings", stepIcon: Settings,
                body: (<div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>Go to <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">Settings → Okta SSO Configuration</code> and fill in:</p>
                  <div className="rounded-lg border border-border overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-muted/60"><tr><th className="text-left px-4 py-2 font-medium text-foreground">Field</th><th className="text-left px-4 py-2 font-medium text-foreground">Value</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        {[["Okta Domain","https://your-org.okta.com"],["Client ID","From Step 01"],["Client Secret","From Step 01"]].map(([f,v])=>(
                          <tr key={f}><td className="px-4 py-2.5 font-mono text-[10px] text-foreground">{f}</td><td className="px-4 py-2.5 text-muted-foreground">{v}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>Click <strong className="text-foreground">Test Okta Integration</strong> to verify connectivity, then <strong className="text-foreground">Save &amp; Enable</strong>.</p>
                </div>),
              },
              {
                num: "03", title: "Assign Users & Groups in Okta", stepIcon: Shield,
                body: (<div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>In the DNSGuard Okta app, open the <strong className="text-foreground">Assignments</strong> tab.</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs">
                    <li>Click <strong className="text-foreground">Assign → Assign to Groups</strong> and add your DNS groups.</li>
                    <li>Suggested groups: <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">dnsguard-admins</code>, <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">dnsguard-operators</code>, <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">dnsguard-viewers</code>.</li>
                    <li>Only assigned users can sign in — unassigned users are blocked at the Okta login screen.</li>
                  </ol>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>Avoid assigning the Okta <em>Everyone</em> group unless all Okta users should access DNSGuard.</span></div>
                </div>),
              },
              {
                num: "05", title: "Enable Multi-Factor Authentication (MFA)", stepIcon: Shield,
                body: (<div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>MFA enforcement is delegated entirely to Okta — DNSGuard does not handle MFA itself. Follow these steps in your Okta Admin Console:</p>
                  <ol className="list-decimal list-inside space-y-2 text-xs">
                    <li>Go to <strong className="text-foreground">Security → Multifactor</strong> and enable at least one factor (Okta Verify, Google Authenticator, or WebAuthn/FIDO2 recommended).</li>
                    <li>Navigate to <strong className="text-foreground">Security → Authentication Policies</strong> and click <strong className="text-foreground">Add a Policy</strong>.</li>
                    <li>Name the policy (e.g. <em>DNSGuard MFA Policy</em>), add a rule that targets the DNSGuard application, and set <strong className="text-foreground">Authentication → Possession factor</strong> to <em>Required</em>.</li>
                    <li>Assign this policy to the DNSGuard OIDC app: open the app, go to the <strong className="text-foreground">Sign On</strong> tab → <strong className="text-foreground">Authentication policy</strong> → select your new policy.</li>
                    <li>Save and test — users will now be prompted for MFA every time they sign in to DNSGuard (or based on your session/re-auth rules).</li>
                  </ol>
                  <div className="rounded-lg border border-border overflow-hidden text-xs mt-3">
                    <table className="w-full">
                      <thead className="bg-muted/60"><tr><th className="text-left px-4 py-2 font-medium text-foreground">Factor</th><th className="text-left px-4 py-2 font-medium text-foreground">Security</th><th className="text-left px-4 py-2 font-medium text-foreground">Notes</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        {[
                          ["Okta Verify (push)", "High", "Best UX — one-tap approval on mobile"],
                          ["FIDO2 / WebAuthn", "Very High", "Phishing-resistant hardware key (YubiKey, Touch ID)"],
                          ["Google Authenticator", "Medium", "TOTP — works offline, no push"],
                          ["SMS / Voice", "Low", "Avoid — susceptible to SIM-swap attacks"],
                        ].map(([f, s, n]) => (
                          <tr key={f}><td className="px-4 py-2.5 font-mono text-[10px] text-foreground">{f}</td><td className="px-4 py-2.5 text-muted-foreground">{s}</td><td className="px-4 py-2.5 text-muted-foreground">{n}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary mt-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>Okta Verify with push notification + number challenge is the recommended default for enterprise environments.</span></div>
                </div>),
              },
              {
                num: "04", title: "Add a Groups Claim to the ID Token", stepIcon: Key,
                body: (<div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>To pass group membership for role resolution, add a <strong className="text-foreground">Groups claim</strong> to the ID token.</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs">
                    <li>In the Okta app go to <strong className="text-foreground">Sign On → OpenID Connect ID Token → Edit</strong>.</li>
                    <li>Add a claim: Name <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">groups</code>, Type: Groups, Filter: Starts with <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">dnsguard-</code>, Include in: Any scope. Save.</li>
                  </ol>
                  <div className="rounded-lg border border-border overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-muted/60"><tr><th className="text-left px-4 py-2 font-medium text-foreground">Claim</th><th className="text-left px-4 py-2 font-medium text-foreground">Type</th><th className="text-left px-4 py-2 font-medium text-foreground">Filter</th><th className="text-left px-4 py-2 font-medium text-foreground">Include in</th></tr></thead>
                      <tbody><tr><td className="px-4 py-2.5 font-mono text-[10px] text-foreground">groups</td><td className="px-4 py-2.5 text-muted-foreground">Groups</td><td className="px-4 py-2.5 text-muted-foreground">Starts with: <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">dnsguard-</code></td><td className="px-4 py-2.5 text-muted-foreground">Any scope</td></tr></tbody>
                    </table>
                  </div>
                </div>),
              },
              {
                num: "06", title: "Verify the Integration", stepIcon: CheckCircle2,
                body: (<div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <ol className="list-decimal list-inside space-y-1.5 text-xs">
                    <li>In DNSGuard Settings, click <strong className="text-foreground">Test Okta Integration</strong> — confirm <em>Connected</em> status is shown.</li>
                    <li>Open a private browser window and navigate to DNSGuard — you should be redirected to Okta.</li>
                    <li>Sign in with an <em>assigned</em> Okta user + MFA. Confirm you land on the DNSGuard dashboard.</li>
                    <li>Try an <em>unassigned</em> user — Okta should show <em>User is not assigned to the client application</em>.</li>
                    <li>Check <strong className="text-foreground">Reports → System Log</strong> in Okta for any SSO errors.</li>
                  </ol>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span><strong>Troubleshooting:</strong> <em>redirect_uri_mismatch</em> → verify the redirect URI in the Okta app matches exactly. <em>CORS error</em> → add your DNSGuard origin under <strong>Security → API → Trusted Origins</strong>.</span></div>
                </div>),
              },
            ] as { num: string; title: string; stepIcon: React.ElementType; body: React.ReactNode }[]).map((step) => (
              <div key={step.num} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm font-mono shrink-0">{step.num}</div>
                  <step.stepIcon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                </div>
                {step.body}
              </div>
            ))}

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4"><FileText className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Quick Reference — OIDC Endpoints</h3></div>
              <div className="rounded-lg border border-border overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-muted/60"><tr><th className="text-left px-4 py-2 font-medium text-foreground">Endpoint</th><th className="text-left px-4 py-2 font-medium text-foreground">URL</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {[["Authorization","https://your-org.okta.com/oauth2/default/v1/authorize"],["Token","https://your-org.okta.com/oauth2/default/v1/token"],["UserInfo","https://your-org.okta.com/oauth2/default/v1/userinfo"],["JWKS (keys)","https://your-org.okta.com/oauth2/default/v1/keys"],["Discovery","https://your-org.okta.com/.well-known/openid-configuration"]].map(([n,u])=>(
                      <tr key={n}><td className="px-4 py-2.5 font-medium text-foreground">{n}</td><td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{u}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Replace <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">your-org.okta.com</code> with your Okta domain. If using a custom auth server, replace <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">default</code> with that server's ID.</p>
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
