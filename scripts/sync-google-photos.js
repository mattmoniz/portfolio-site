#!/usr/bin/env node

/**
 * Handyman Website - 100% Cloud-Direct Google Photos Album Sync
 *
 * - Scans the shared Google Photos Cloud Album over HTTPS (zero local Mac access, zero local image files).
 * - Checks against live projects (src/data/projects.json), staged projects (src/data/stagedProjects.json),
 *   and synced/rejected memory (src/data/syncedMedia.json) using both URL and in-memory MD5 hash.
 * - Stages any newly discovered cloud photo URLs into src/data/stagedProjects.json for review in /handyman/admin.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG_PATH = path.join(ROOT_DIR, "photo-sync.config.json");
const PROJECTS_PATH = path.join(ROOT_DIR, "src", "data", "projects.json");
const STAGED_PROJECTS_PATH = path.join(ROOT_DIR, "src", "data", "stagedProjects.json");
const SYNCED_MEDIA_PATH = path.join(ROOT_DIR, "src", "data", "syncedMedia.json");

let config = {
  googlePhotosAlbumUrl: "https://photos.app.goo.gl/rzsCye2XgjAZUvW69",
  maxDimension: 1600,
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch (err) {
    console.warn("⚠️ Failed to parse photo-sync.config.json, using defaults.", err.message);
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
let albumUrl = config.googlePhotosAlbumUrl;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) albumUrl = args[++i];
}

function readJsonSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function scrapeCloudAlbumPhotos(url) {
  console.log(`☁️  Checking Google Cloud Album: ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Cloud album (HTTP ${res.status})`);
  }
  const html = await res.text();
  const matches = html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_-]+/g);
  if (!matches) return [];
  const dim = config.maxDimension || 1600;
  return Array.from(new Set(matches)).map((base) => `${base}=w${dim}-h${dim}-no`);
}

async function main() {
  console.log("==================================================");
  console.log("☁️  Handyman Cloud-Direct Photo Sync");
  console.log("==================================================");

  const liveProjects = readJsonSafe(PROJECTS_PATH, []);
  const stagedProjects = readJsonSafe(STAGED_PROJECTS_PATH, []);
  const syncedManifest = readJsonSafe(SYNCED_MEDIA_PATH, {
    syncedIds: [],
    hashes: {},
    rejectedHashes: {},
    seenBaseUrls: [],
    lastSync: null,
    totalSynced: 0,
  });

  if (!Array.isArray(syncedManifest.seenBaseUrls)) {
    syncedManifest.seenBaseUrls = [];
  }

  const existingBaseUrls = new Set(syncedManifest.seenBaseUrls);

  const collectProjectUrls = (projects) => {
    if (!Array.isArray(projects)) return;
    for (const p of projects) {
      if (p.coverImage && p.coverImage.startsWith("http")) {
        existingBaseUrls.add(p.coverImage.split("=")[0]);
      }
      for (const img of p.images || []) {
        if (img.file && img.file.startsWith("http")) {
          existingBaseUrls.add(img.file.split("=")[0]);
        }
      }
    }
  };

  collectProjectUrls(liveProjects);
  collectProjectUrls(stagedProjects);

  const cloudPhotos = await scrapeCloudAlbumPhotos(albumUrl);
  console.log(`📸 Found ${cloudPhotos.length} total photo(s) in cloud album.`);

  const newCloudUrls = [];
  let manifestUpdated = false;

  for (let i = 0; i < cloudPhotos.length; i++) {
    const highResUrl = cloudPhotos[i];
    const baseUrl = highResUrl.split("=")[0];

    if (existingBaseUrls.has(baseUrl)) {
      continue;
    }

    // Check in-memory MD5 hash against existing synced/rejected photos (zero local disk storage)
    try {
      const res = await fetch(highResUrl);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const md5 = crypto.createHash("md5").update(buf).digest("hex");

      if (
        (syncedManifest.rejectedHashes && syncedManifest.rejectedHashes[md5]) ||
        (syncedManifest.hashes && syncedManifest.hashes[md5]) ||
        (Array.isArray(syncedManifest.syncedIds) && syncedManifest.syncedIds.includes(md5))
      ) {
        existingBaseUrls.add(baseUrl);
        if (!syncedManifest.seenBaseUrls.includes(baseUrl)) {
          syncedManifest.seenBaseUrls.push(baseUrl);
          manifestUpdated = true;
        }
        continue;
      }

      // Genuine new cloud photo!
      existingBaseUrls.add(baseUrl);
      syncedManifest.seenBaseUrls.push(baseUrl);
      syncedManifest.syncedIds.push(md5);
      syncedManifest.hashes[md5] = highResUrl;
      manifestUpdated = true;
      newCloudUrls.push(highResUrl);
    } catch (err) {
      console.warn(`  ⚠️ Could not verify cloud photo ${i + 1}:`, err.message);
    }
  }

  if (newCloudUrls.length === 0) {
    if (manifestUpdated && !dryRun) {
      syncedManifest.lastSync = new Date().toISOString();
      syncedManifest.totalSynced = syncedManifest.syncedIds.length;
      fs.writeFileSync(SYNCED_MEDIA_PATH, JSON.stringify(syncedManifest, null, 2) + "\n", "utf8");
    }
    console.log("✨ All cloud album photos are already synced or staged. Nothing new to add!");
    return;
  }

  console.log(`🎉 Discovered ${newCloudUrls.length} new cloud photo(s)! Staging for /handyman/admin...`);

  const newStagedDraft = {
    id: `staged-${Date.now()}`,
    title: "New Handyman Project",
    category: "Home Repairs & Improvements",
    featured: true,
    summary: "Recently completed project photos ready for client showcase.",
    description: "Detailed description of materials used, custom fabrication, and work performed.",
    tags: ["New Work", "Handyman"],
    coverImage: newCloudUrls[0],
    images: newCloudUrls.map((url, idx) => ({
      file: url,
      caption: `Photo ${idx + 1}`,
    })),
  };

  const updatedStaged = [newStagedDraft, ...(Array.isArray(stagedProjects) ? stagedProjects : [])];
  syncedManifest.lastSync = new Date().toISOString();
  syncedManifest.totalSynced = syncedManifest.syncedIds.length;

  if (!dryRun) {
    fs.writeFileSync(STAGED_PROJECTS_PATH, JSON.stringify(updatedStaged, null, 2) + "\n", "utf8");
    fs.writeFileSync(SYNCED_MEDIA_PATH, JSON.stringify(syncedManifest, null, 2) + "\n", "utf8");
    console.log("✅ Staged new cloud photos into src/data/stagedProjects.json.");
  } else {
    console.log("ℹ️ Dry run complete (no files written).");
  }
}

main().catch((err) => {
  console.error("❌ Cloud photo sync error:", err.message);
  process.exit(1);
});
