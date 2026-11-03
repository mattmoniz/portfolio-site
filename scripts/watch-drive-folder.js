#!/usr/bin/env node

/**
 * Handyman Website - Continuous Google Drive Folder Watcher & Staging Daemon
 * 
 * Features:
 * - Continuously watches Google Drive "Handy Projects Photos" for new uploads.
 * - Debounces file events so full multi-photo uploads finish syncing before processing.
 * - Checks Permanent Rejection Memory (rejectedHashes): silently archives rejected photos without prompting.
 * - Optimizes photos into src/assets/handyman/ and stages projects in dev.
 * - Dispatches lockscreen push notifications (ntfy) with action buttons and macOS system banners.
 * - Starts a local approval webhook server (port 5555) so 1-tap links can approve directly!
 */

import fs from "fs";
import path from "path";
import http from "http";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { syncPhotos } from "./sync-google-photos.js";
import { notifyAll, sendMacNotification, sendNtfyPush } from "./notify-phone.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "photo-sync.config.json");

let config = {
  incomingFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos",
  archiveFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos/_processed",
  rejectedFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos/_processed/rejected",
  ntfyTopic: "matt-handyman-photos-monizri",
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {}
}

const targetFolder = config.incomingFolder;
let isProcessing = false;
let debounceTimer = null;
const DEBOUNCE_DELAY_MS = 6000; // 6 seconds debounce to allow full multi-file phone upload to sync

console.log("==================================================");
console.log("👁️  Handyman Google Drive Watcher Daemon Active");
console.log("==================================================");
console.log(`📁 Watching: ${targetFolder}`);
console.log(`🔔 Notifications: ntfy.sh/${config.ntfyTopic} + macOS Banners`);
console.log("==================================================\n");

// Ensure folders exist
fs.mkdirSync(targetFolder, { recursive: true });
fs.mkdirSync(config.archiveFolder, { recursive: true });
fs.mkdirSync(config.rejectedFolder, { recursive: true });

/**
 * Runs the sync pipeline and dispatches multi-channel alerts
 */
async function triggerSyncPipeline() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    console.log(`\n⚡ [${new Date().toLocaleTimeString()}] Activity detected in Google Drive! Processing...`);
    const result = await syncPhotos();

    if (result && result.newPhotosCount > 0) {
      const firstProject = result.stagedProjects[0] || {
        title: "Recent Handyman Work",
        category: "Recent Work",
      };

      await notifyAll({
        projectTitle: firstProject.title,
        photoCount: result.newPhotosCount,
        category: firstProject.category,
      });
    } else if (result && result.rejectedCount > 0) {
      console.log(`ℹ️ Cleaned up ${result.rejectedCount} previously rejected photo(s).`);
    }
  } catch (err) {
    console.error("⚠️ Watcher sync error:", err.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Debounced trigger
 */
function onFolderChange(eventType, filename) {
  if (!filename) return;
  if (filename.startsWith(".") || filename === "_processed") return;

  console.log(`📝 Detected change: ${filename} (waiting for upload to complete...)`);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerSyncPipeline();
  }, DEBOUNCE_DELAY_MS);
}

// Start watching Google Drive folder recursively
try {
  fs.watch(targetFolder, { recursive: true }, onFolderChange);
  console.log("✅ Live folder watcher established successfully.");
} catch (err) {
  console.error("❌ Failed to attach watcher to folder:", err.message);
  process.exit(1);
}

/**
 * Lightweight Local Approval Webhook Server (Port 5555)
 * Allows 1-tap approval from phone or local browser
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/approve") {
    console.log("\n🚀 Received approval webhook trigger!");
    try {
      execSync("node scripts/approve-and-deploy.js", { cwd: ROOT_DIR, stdio: "inherit" });
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html><body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: white;">
          <h1 style="color: #4ade80;">✅ Handyman Photos Approved!</h1>
          <p>Your updates are deploying live to <a style="color: #38bdf8;" href="https://mattmoniz.io/handyman">mattmoniz.io/handyman</a>.</p>
        </body></html>
      `);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Deploy failed: " + err.message);
    }
    return;
  }

  if (url.pathname === "/reject") {
    console.log("\n🚫 Received reject webhook trigger!");
    try {
      execSync("node scripts/reject-project.js", { cwd: ROOT_DIR, stdio: "inherit" });
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html><body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: white;">
          <h1 style="color: #f87171;">🚫 Photos Rejected & Suppressed</h1>
          <p>The photos have been added to permanent rejection memory. You will never be asked about them again.</p>
        </body></html>
      `);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Reject failed: " + err.message);
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const PORT = 5555;
server.listen(PORT, () => {
  console.log(`🌐 Local Approval Webhook Server listening on port ${PORT}`);
  console.log(`   - Approve: http://localhost:${PORT}/approve`);
  console.log(`   - Reject:  http://localhost:${PORT}/reject`);
});

// Run initial scan on startup to catch any photos dropped while offline
triggerSyncPipeline();
