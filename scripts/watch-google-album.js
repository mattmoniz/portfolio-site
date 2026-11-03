#!/usr/bin/env node

/**
 * Handyman Website - Google Photos Shared Album Auto-Sync Watcher
 * 
 * ZERO-LOCAL-STORAGE CLOUD-DIRECT EDITION:
 * - Continuously monitors your "Handy project photos" Google Photos album.
 * - Extracts full-resolution photo URLs directly from Google's CDN.
 * - Perceptual Visual Duplicate Detection (dHash via macOS sips):
 *   Detects visually identical images regardless of resolution, compression, or EXIF differences.
 * - Rejection memory: Prevents previously rejected photos (like personal mirror selfies) from returning.
 * - ZERO LOCAL DISK USAGE: Images are streamed directly from Google's Cloud CDN (lh3.googleusercontent.com).
 *   Temporary files used for hash calculation in /tmp are immediately destroyed.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import os from "os";
import { sendMacNotification } from "./notify-phone.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG_PATH = path.join(ROOT_DIR, "photo-sync.config.json");
const ASSETS_DIR = path.join(ROOT_DIR, "src", "assets", "handyman");
const SYNCED_MEDIA_PATH = path.join(ROOT_DIR, "src", "data", "syncedMedia.json");
const PROJECTS_PATH = path.join(ROOT_DIR, "src", "data", "projects.json");
const AUTO_PROJECTS_PATH = path.join(ROOT_DIR, "src", "data", "autoSyncedProjects.json");
const TEMP_DIR = path.join(os.tmpdir(), "handy_album_sync");

fs.mkdirSync(TEMP_DIR, { recursive: true });

let config = {
  googlePhotosAlbumUrl: "https://photos.app.goo.gl/rzsCye2XgjAZUvW69",
  maxDimension: 1600,
  quality: 85,
  duplicateThreshold: 8, // Hamming distance <= 8 is considered a visual duplicate
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {}
}

const args = process.argv.slice(2);
let runOnce = args.includes("--once");
let albumUrl = config.googlePhotosAlbumUrl;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) albumUrl = args[++i];
}

function getFileHash(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

/**
 * Calculates a 64-bit difference hash (dHash) using macOS sips
 * Resizes image to 9x8 grayscale and computes relative luminance gradient.
 */
function getVisualHash(filePath) {
  const tmpBmp = path.join(TEMP_DIR, `hash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.bmp`);
  try {
    execSync(`sips -s format bmp -z 8 9 "${filePath}" --out "${tmpBmp}"`, { stdio: "ignore" });
    const buf = fs.readFileSync(tmpBmp);
    try { fs.unlinkSync(tmpBmp); } catch {}

    const offset = buf.readUInt32LE(10);
    let hash = "";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const idx1 = offset + (r * 9 + c) * 3;
        const idx2 = offset + (r * 9 + c + 1) * 3;
        const gray1 = buf[idx1] * 0.11 + buf[idx1 + 1] * 0.59 + buf[idx1 + 2] * 0.3;
        const gray2 = buf[idx2] * 0.11 + buf[idx2 + 1] * 0.59 + buf[idx2 + 2] * 0.3;
        hash += gray1 < gray2 ? "1" : "0";
      }
    }
    return hash;
  } catch (err) {
    try { if (fs.existsSync(tmpBmp)) fs.unlinkSync(tmpBmp); } catch {}
    return null;
  }
}

function hammingDistance(h1, h2) {
  if (!h1 || !h2 || h1.length !== h2.length) return 999;
  let dist = 0;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] !== h2[i]) dist++;
  }
  return dist;
}

let knownVisualHashes = {}; // identifier -> dHash

function indexExistingAssets() {
  knownVisualHashes = {};
  if (fs.existsSync(ASSETS_DIR)) {
    const files = fs.readdirSync(ASSETS_DIR).filter((f) => f.match(/\.(jpg|jpeg|png)$/i));
    for (const file of files) {
      const fullPath = path.join(ASSETS_DIR, file);
      const hash = getVisualHash(fullPath);
      if (hash) {
        knownVisualHashes[file] = hash;
      }
    }
  }
  console.log(`🖼️  Indexed ${Object.keys(knownVisualHashes).length} existing gallery photos for visual duplicate prevention.`);
}

let syncedManifest = { syncedIds: [], hashes: {}, rejectedHashes: {}, lastSync: null, totalSynced: 0 };
function loadManifests() {
  if (fs.existsSync(SYNCED_MEDIA_PATH)) {
    try {
      syncedManifest = JSON.parse(fs.readFileSync(SYNCED_MEDIA_PATH, "utf8"));
      if (!syncedManifest.rejectedHashes) syncedManifest.rejectedHashes = {};
      if (!syncedManifest.hashes) syncedManifest.hashes = {};
      if (!syncedManifest.syncedIds) syncedManifest.syncedIds = [];
    } catch {}
  }
}

let allProjects = [];
function loadProjects() {
  const targetFile = fs.existsSync(PROJECTS_PATH) ? PROJECTS_PATH : AUTO_PROJECTS_PATH;
  if (fs.existsSync(targetFile)) {
    try {
      allProjects = JSON.parse(fs.readFileSync(targetFile, "utf8"));
      if (!Array.isArray(allProjects)) allProjects = [];
    } catch {}
  }
}

async function scrapeAlbumPhotos(url) {
  console.log(`\n🔍 Checking Google Photos Album: ${url}`);
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.error(`⚠️ Failed to load album URL (HTTP ${res.status})`);
      return [];
    }

    const html = await res.text();
    const matches = html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g);
    if (!matches) {
      console.log("ℹ️ No photo URLs found in album page.");
      return [];
    }

    const uniqueUrls = Array.from(new Set(matches));
    console.log(`📸 Album contains ${uniqueUrls.length} total photo link(s).`);
    return uniqueUrls;
  } catch (err) {
    console.error("⚠️ Album scrape error:", err.message);
    return [];
  }
}

async function syncAlbumOnce() {
  loadManifests();
  loadProjects();
  indexExistingAssets();

  const photoUrls = await scrapeAlbumPhotos(albumUrl);
  if (photoUrls.length === 0) return 0;

  const newCloudUrls = [];

  for (let i = 0; i < photoUrls.length; i++) {
    const highResUrl = `${photoUrls[i]}=w${config.maxDimension || 1600}-h${config.maxDimension || 1600}-no`;

    try {
      const res = await fetch(highResUrl);
      if (!res.ok) continue;

      const imgBuffer = Buffer.from(await res.arrayBuffer());
      const rawMd5 = getFileHash(imgBuffer);

      // Check explicit rejection memory
      if (syncedManifest.rejectedHashes && syncedManifest.rejectedHashes[rawMd5]) {
        console.log(`  🔇 [REJECTED] Photo ${i + 1} is in rejection memory (${syncedManifest.rejectedHashes[rawMd5]}). Skipping.`);
        continue;
      }

      // Check duplicate
      if (syncedManifest.hashes && syncedManifest.hashes[rawMd5]) {
        console.log(`  ⏭️ Photo ${i + 1} is already synced. Skipping.`);
        continue;
      }

      // Buffer temporarily in /tmp only for visual perceptual hash calculation
      const tempPath = path.join(TEMP_DIR, `temp-${Date.now()}-${i + 1}.jpg`);
      fs.writeFileSync(tempPath, imgBuffer);

      const visualHash = getVisualHash(tempPath);
      try { fs.unlinkSync(tempPath); } catch {}

      let duplicateMatch = null;
      let minDistance = 999;

      if (visualHash) {
        for (const [existingFile, existingHash] of Object.entries(knownVisualHashes)) {
          const dist = hammingDistance(visualHash, existingHash);
          if (dist < minDistance) {
            minDistance = dist;
            duplicateMatch = existingFile;
          }
        }
      }

      // Check against duplicate threshold
      if (minDistance <= (config.duplicateThreshold || 8)) {
        console.log(`  🛑 [DUPLICATE DETECTED] Photo ${i + 1} visually matches existing '${duplicateMatch}' (distance: ${minDistance}). Skipping.`);
        syncedManifest.hashes[rawMd5] = duplicateMatch;
        continue;
      }

      // Genuine new photo! Register cloud URL with ZERO local file saves
      if (visualHash) {
        knownVisualHashes[highResUrl] = visualHash;
      }
      syncedManifest.syncedIds.push(rawMd5);
      syncedManifest.hashes[rawMd5] = highResUrl;
      newCloudUrls.push(highResUrl);
      console.log(`  ☁️ Staged new cloud photo ${i + 1} (Zero local disk usage)`);
    } catch (err) {
      console.warn(`  ⚠️ Failed to process photo ${i + 1}:`, err.message);
    }
  }

  if (newCloudUrls.length > 0) {
    let unassignedProject = allProjects.find((p) => p.id === "recent-album-additions");
    if (!unassignedProject) {
      unassignedProject = {
        id: "recent-album-additions",
        title: "Recently Added Project Photos",
        category: "Home Repairs & Improvements",
        featured: true,
        summary: "Newly added photos synced from your Google Photos album, staged for review directly from Google Cloud.",
        description: "New photos synchronized directly from your Google Photos album. Rendered seamlessly from Google Cloud CDN with zero local storage footprint.",
        tags: ["Recent Work", "Cloud Synced", "New Project"],
        coverImage: newCloudUrls[0],
        images: [],
      };
      allProjects.unshift(unassignedProject);
    }

    for (const url of newCloudUrls) {
      unassignedProject.images.push({
        file: url,
        caption: `Cloud Photo (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
      });
    }

    if (!unassignedProject.coverImage && unassignedProject.images.length > 0) {
      unassignedProject.coverImage = unassignedProject.images[0].file;
    }

    // Save manifests
    syncedManifest.lastSync = new Date().toISOString();
    syncedManifest.totalSynced = syncedManifest.syncedIds.length;

    fs.writeFileSync(SYNCED_MEDIA_PATH, JSON.stringify(syncedManifest, null, 2), "utf8");
    if (fs.existsSync(PROJECTS_PATH)) {
      fs.writeFileSync(PROJECTS_PATH, JSON.stringify(allProjects, null, 2), "utf8");
    }
    fs.writeFileSync(AUTO_PROJECTS_PATH, JSON.stringify(allProjects, null, 2), "utf8");

    console.log(`\n🎉 Successfully staged ${newCloudUrls.length} new photo(s)!`);
    console.log(`👉 Preview at: http://localhost:5173/handyman`);

    sendMacNotification(
      "📸 New Project Photos Synced!",
      `${newCloudUrls.length} new photo(s) added from Google Photos album.`
    );
  } else {
    console.log("✨ Album is completely up to date. All photos already on site or duplicates skipped.");
  }

  return newCloudUrls.length;
}

async function startDaemon() {
  console.log("==================================================");
  console.log("☁️  Google Photos Cloud-Direct Watcher Daemon Running");
  console.log("==================================================");
  console.log(`🖼️  Album URL: ${albumUrl}`);
  console.log(`⏱️  Polling Interval: Every 3 minutes`);
  console.log(`💾 Local Disk Usage: 0 BYTES (Cloud Streaming)`);
  console.log(`🛡️  Visual Duplicate Threshold: Hamming distance <= ${config.duplicateThreshold || 8}`);
  console.log("==================================================");

  await syncAlbumOnce();

  if (runOnce) {
    process.exit(0);
  }

  setInterval(async () => {
    try {
      await syncAlbumOnce();
    } catch (err) {
      console.error("⚠️ Watcher poll error:", err.message);
    }
  }, 180000);
}

startDaemon().catch(console.error);
