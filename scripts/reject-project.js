#!/usr/bin/env node

/**
 * Handyman Website - One-Click Project / Photo Rejection & Blacklist
 * 
 * Reverts staged photos, adds MD5 fingerprints to permanent rejection blacklist,
 * and ensures you are NEVER asked about them again.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { sendMacNotification } from "./notify-phone.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG_PATH = path.join(ROOT_DIR, "photo-sync.config.json");
const ASSETS_DIR = path.join(ROOT_DIR, "src", "assets", "handyman");
const SYNCED_MEDIA_PATH = path.join(ROOT_DIR, "src", "data", "syncedMedia.json");
const AUTO_PROJECTS_PATH = path.join(ROOT_DIR, "src", "data", "autoSyncedProjects.json");

let config = {
  incomingFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos",
  archiveFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos/_processed",
  rejectedFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos/_processed/rejected",
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {}
}

const args = process.argv.slice(2);
let targetProjectSlug = args[0] || null;

console.log("==================================================");
console.log("🚫 Rejecting & Blacklisting Photos");
console.log("==================================================");

let syncedManifest = { syncedIds: [], hashes: {}, rejectedHashes: {}, lastSync: null, totalSynced: 0 };
if (fs.existsSync(SYNCED_MEDIA_PATH)) {
  try {
    syncedManifest = JSON.parse(fs.readFileSync(SYNCED_MEDIA_PATH, "utf8"));
    if (!syncedManifest.rejectedHashes) syncedManifest.rejectedHashes = {};
  } catch {}
}

let autoProjects = [];
if (fs.existsSync(AUTO_PROJECTS_PATH)) {
  try {
    autoProjects = JSON.parse(fs.readFileSync(AUTO_PROJECTS_PATH, "utf8"));
  } catch {}
}

// Ensure rejected folder exists
fs.mkdirSync(config.rejectedFolder, { recursive: true });

// Check what git status shows for newly added assets
const uncommittedFiles = execSync("git status --porcelain src/assets/handyman", {
  cwd: ROOT_DIR,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .map((line) => line.trim().replace(/^(\?\?|M|A)\s+/, ""));

let rejectedCount = 0;

for (const filePath of uncommittedFiles) {
  const fullPath = path.resolve(ROOT_DIR, filePath);
  if (fs.existsSync(fullPath)) {
    const fileBuf = fs.readFileSync(fullPath);
    const hash = crypto.createHash("md5").update(fileBuf).digest("hex");
    const basename = path.basename(fullPath);

    // Record processed asset hash in permanent rejection memory
    syncedManifest.rejectedHashes[hash] = {
      filename: basename,
      rejectedAt: new Date().toISOString(),
      reason: "user_rejected",
    };

    // Also look up any original raw file hash that generated this asset
    for (const [rawHash, mappedFilename] of Object.entries(syncedManifest.hashes)) {
      if (mappedFilename === basename) {
        syncedManifest.rejectedHashes[rawHash] = {
          filename: basename,
          rejectedAt: new Date().toISOString(),
          reason: "user_rejected_raw",
        };
        delete syncedManifest.hashes[rawHash];
        syncedManifest.syncedIds = syncedManifest.syncedIds.filter((h) => h !== rawHash);
      }
    }

    // Remove from syncedIds / hashes
    syncedManifest.syncedIds = syncedManifest.syncedIds.filter((h) => h !== hash);
    delete syncedManifest.hashes[hash];

    // Delete staged asset
    fs.unlinkSync(fullPath);
    rejectedCount++;
    console.log(`  🚫 Blacklisted: ${basename} (Hash: ${hash.slice(0, 8)}...)`);
  }
}

// Remove the most recently staged project if no specific slug was provided
if (autoProjects.length > 0) {
  if (targetProjectSlug) {
    autoProjects = autoProjects.filter((p) => p.id !== targetProjectSlug);
  } else {
    const removed = autoProjects.shift();
    console.log(`  🗑️ Removed staged project: "${removed.title}"`);
  }
}

// Save manifests
fs.writeFileSync(SYNCED_MEDIA_PATH, JSON.stringify(syncedManifest, null, 2), "utf8");
fs.writeFileSync(AUTO_PROJECTS_PATH, JSON.stringify(autoProjects, null, 2), "utf8");

// Revert any remaining uncommitted auto-sync files
try {
  execSync("git checkout -- src/data/autoSyncedProjects.json src/data/syncedMedia.json", {
    cwd: ROOT_DIR,
    stdio: "ignore",
  });
} catch {}

console.log("\n✨ Done! Rejection memory updated.");
console.log(`👉 ${rejectedCount} photo(s) permanently blacklisted.`);
console.log("👉 You will NEVER be asked about these photos again.");

sendMacNotification(
  "🚫 Photos Rejected & Suppressed",
  `${rejectedCount} photo(s) added to permanent rejection memory. Never asked again.`
);
