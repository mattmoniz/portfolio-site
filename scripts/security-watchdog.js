#!/usr/bin/env node

/**
 * Always-On Cloud Security Watchdog
 *
 * Performs automated static analysis (SAST), secret scanning, admin endpoint hardening verification,
 * HTTP security header verification, and live production endpoint probing.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const checkLive = args.includes("--live");
const LIVE_SITE_URL = "https://mattmoniz.io";
const LIVE_ADMIN_API_URL = "https://mattmoniz.io/.netlify/functions/handyman-admin";

const issues = [];
const passed = [];

function fail(category, message) {
  issues.push({ category, message });
  console.error(`  ❌ [FAIL] [${category}] ${message}`);
}

function pass(category, message) {
  passed.push({ category, message });
  console.log(`  ✅ [PASS] [${category}] ${message}`);
}

function walkFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === ".claude" ||
      entry.name === ".gemini" ||
      entry.name === "dist" ||
      entry.name.startsWith(".tmp")
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, fileList);
    } else if (/\.(js|jsx|ts|tsx|json|yml|yaml|toml|html)$/i.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// 1. Secret & Credential Leak Scanner
function checkSecretsAndCredentials(files) {
  const secretPatterns = [
    { name: "GitHub Personal Access Token", regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/ },
    { name: "GitHub Fine-Grained Token", regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
    { name: "Private Cryptographic Key", regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { name: "AWS Access Key ID", regex: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: "Hardcoded Fallback Passcode (matt2026)", regex: /["']matt2026["']/i },
    { name: "URL Query Auth Bypass", regex: /searchParams\.get\(["']key["']\)/ },
  ];

  let foundLeak = false;
  for (const file of files) {
    const rel = path.relative(ROOT_DIR, file);
    if (rel === "package-lock.json" || rel === "scripts/security-watchdog.js") continue;
    const content = fs.readFileSync(file, "utf8");

    for (const pat of secretPatterns) {
      if (pat.regex.test(content)) {
        fail("Secrets & Credentials", `${pat.name} detected in ${rel}`);
        foundLeak = true;
      }
    }
  }

  // Ensure .env is ignored by git and not tracked
  try {
    const trackedEnv = execSync("git ls-files .env .env.*", { cwd: ROOT_DIR, encoding: "utf8" }).trim();
    if (trackedEnv) {
      fail("Secrets & Credentials", `.env file is tracked in git: ${trackedEnv}`);
      foundLeak = true;
    }
  } catch {}

  if (!foundLeak) {
    pass("Secrets & Credentials", "Zero leaked tokens, private keys, or hardcoded passcodes in codebase.");
  }
}

// 2. Static Application Security Testing (XSS / Code Injection / Local Path Leak)
function checkCodeVulnerabilities(files) {
  const dangerousPatterns = [
    { name: "React dangerouslySetInnerHTML (XSS risk)", regex: /dangerouslySetInnerHTML/ },
    { name: "Dynamic eval() execution", regex: /\beval\s*\(/ },
    { name: "Dynamic Function() constructor", regex: /\bnew\s+Function\s*\(/ },
    { name: "Hardcoded Local Mac Path", regex: /\/Users\/matthewmoniz/i },
  ];

  let foundVuln = false;
  for (const file of files) {
    const rel = path.relative(ROOT_DIR, file);
    if (rel === "package-lock.json" || rel === "scripts/security-watchdog.js") continue;
    const content = fs.readFileSync(file, "utf8");

    for (const pat of dangerousPatterns) {
      if (pat.regex.test(content)) {
        fail("Code Security (SAST)", `${pat.name} found in ${rel}`);
        foundVuln = true;
      }
    }
  }

  if (!foundVuln) {
    pass("Code Security (SAST)", "Zero XSS sinks, dynamic eval calls, or local host paths found.");
  }
}

// 3. Admin Serverless API Hardening Audit
function checkAdminFunctionHardening() {
  const adminFnPath = path.join(ROOT_DIR, "netlify", "functions", "handyman-admin.js");
  if (!fs.existsSync(adminFnPath)) {
    fail("Admin API Security", "netlify/functions/handyman-admin.js is missing.");
    return;
  }

  const code = fs.readFileSync(adminFnPath, "utf8");
  const checks = [
    {
      name: "HMAC-SHA256 Signed Session Tokens",
      ok: code.includes("createHmac") && code.includes("verifySignedSessionToken"),
    },
    {
      name: "Constant-Time Signature Comparison (timingSafeEqual)",
      ok: code.includes("timingSafeEqual"),
    },
    {
      name: "Google SSO-Only Authentication (No Passcode Fallback)",
      ok: !code.includes("verify-auth") && !code.includes("ADMIN_PIN"),
    },
    {
      name: "Google OAuth email_verified & Audience (aud) Verification",
      ok: code.includes("payload.email_verified") && code.includes("payload.aud"),
    },
    {
      name: "Strict CORS Origin Allowlist (no wildcard '*')",
      ok: code.includes("ALLOWED_ORIGINS") && !code.includes('"Access-Control-Allow-Origin": "*"'),
    },
    {
      name: "SSRF Domain Allowlist on Album Scraper",
      ok: code.includes("photos.app.goo.gl") && code.includes("parsed.hostname"),
    },
  ];

  for (const c of checks) {
    if (c.ok) {
      pass("Admin API Security", c.name);
    } else {
      fail("Admin API Security", `Missing protection: ${c.name}`);
    }
  }
}

// 4. Netlify Security Headers & CSP Audit
function checkNetlifyHeaders() {
  const tomlPath = path.join(ROOT_DIR, "netlify.toml");
  if (!fs.existsSync(tomlPath)) {
    fail("HTTP Security Headers", "netlify.toml is missing.");
    return;
  }

  const toml = fs.readFileSync(tomlPath, "utf8");
  const requiredHeaders = [
    { name: "X-Frame-Options = DENY (Clickjacking protection)", token: 'X-Frame-Options = "DENY"' },
    { name: "X-Content-Type-Options = nosniff (MIME-sniffing protection)", token: 'X-Content-Type-Options = "nosniff"' },
    { name: "Strict-Transport-Security (HSTS)", token: "Strict-Transport-Security" },
    { name: "Permissions-Policy (Hardware API lockdown)", token: "Permissions-Policy" },
    { name: "Content-Security-Policy (XSS mitigation)", token: "Content-Security-Policy" },
  ];

  for (const h of requiredHeaders) {
    if (toml.includes(h.token)) {
      pass("HTTP Security Headers", h.name);
    } else {
      fail("HTTP Security Headers", `Missing header in netlify.toml: ${h.name}`);
    }
  }

  if (toml.includes("unsafe-eval")) {
    fail("HTTP Security Headers", "Content-Security-Policy must not allow 'unsafe-eval'.");
  }
}

// 5. Live Production Website & Admin Endpoint Penetration Check
async function checkLiveProductionSecurity() {
  console.log(`\n🌐 Probing Live Production Site (${LIVE_SITE_URL})...`);

  try {
    const res = await fetch(LIVE_SITE_URL, { method: "GET", redirect: "follow" });
    if (!res.ok) {
      fail("Live Production Probe", `Live site returned HTTP ${res.status}`);
    } else {
      const hsts = res.headers.get("strict-transport-security");
      const xfo = res.headers.get("x-frame-options");
      const xcto = res.headers.get("x-content-type-options");
      const csp = res.headers.get("content-security-policy");

      if (hsts && xfo && xcto && csp) {
        pass("Live Production Probe", "Live HTTPS headers (HSTS, X-Frame-Options, X-Content-Type-Options, CSP) verified active.");
      } else {
        fail("Live Production Probe", "One or more security headers missing on live production response.");
      }
    }
  } catch (err) {
    fail("Live Production Probe", `Could not reach ${LIVE_SITE_URL}: ${err.message}`);
  }

  // Probe Admin API with forged token to ensure unauthorized writes are rejected
  try {
    const attackRes = await fetch(LIVE_ADMIN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer forged.invalid.token",
      },
      body: JSON.stringify({
        action: "publish-live",
        projects: [],
      }),
    });

    if (attackRes.status === 401 || attackRes.status === 403) {
      pass("Live Production Probe", `Admin API blocked forged token write attempt with HTTP ${attackRes.status}.`);
    } else {
      fail(
        "Live Production Probe",
        `CRITICAL: Admin API did not return 401/403 on forged token (returned HTTP ${attackRes.status})!`
      );
    }
  } catch (err) {
    fail("Live Production Probe", `Could not probe Admin API (${LIVE_ADMIN_API_URL}): ${err.message}`);
  }
}

async function main() {
  console.log("==================================================");
  console.log("🛡️  Cloud Security Watchdog & Vulnerability Audit");
  console.log("==================================================\n");

  const allFiles = walkFiles(ROOT_DIR);

  checkSecretsAndCredentials(allFiles);
  checkCodeVulnerabilities(allFiles);
  checkAdminFunctionHardening();
  checkNetlifyHeaders();

  if (checkLive) {
    await checkLiveProductionSecurity();
  }

  console.log("\n==================================================");
  console.log(`📊 Security Audit Summary: ${passed.length} Passed | ${issues.length} Failed`);
  console.log("==================================================");

  if (issues.length > 0) {
    console.error("\n🚨 SECURITY WATCHDOG ALERT: Vulnerabilities or policy violations detected!");
    process.exit(1);
  } else {
    console.log("\n🔒 All security checks passed. Repository and endpoints are hardened.");
  }
}

main().catch((err) => {
  console.error("Watchdog execution error:", err);
  process.exit(1);
});
