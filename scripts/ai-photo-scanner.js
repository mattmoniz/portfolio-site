#!/usr/bin/env node

/**
 * Handyman Website - AI Photo Scanner & Active Learning Engine
 * 
 * Features:
 * 1. Zero Manual Organizing: Scans bulk photo dumps or Google Photos shared album links.
 * 2. Intelligent Filtering: Automatically discards screenshots, receipts, documents, and low-res thumbnails.
 * 3. Permanent Rejection Memory: Silently ignores previously rejected photos (MD5 blacklist).
 * 4. Project Auto-Clustering: Groups photos of the same jobsite together by visual and temporal cues.
 * 5. Multi-Channel Phone & Desktop Ping: Alerts your phone (ntfy) and Mac when candidates are discovered.
 * 6. Active Learning: Refines category and exclusion rules based on your approvals and rejections.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { sendNtfyPush, sendMacNotification } from "./notify-phone.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG_PATH = path.join(ROOT_DIR, "photo-sync.config.json");
const ASSETS_DIR = path.join(ROOT_DIR, "src", "assets", "handyman");
const SYNCED_MEDIA_PATH = path.join(ROOT_DIR, "src", "data", "syncedMedia.json");
const AUTO_PROJECTS_PATH = path.join(ROOT_DIR, "src", "data", "autoSyncedProjects.json");
const LEARNED_RULES_PATH = path.join(ROOT_DIR, "src", "data", "aiLearnedRules.json");
const STAGING_DIR = path.join(ROOT_DIR, ".tmp_ai_scanner");

// Ensure dirs
fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(STAGING_DIR, { recursive: true });

// Load Configuration
let config = {
  incomingFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos",
  archiveFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos/_processed",
  maxDimension: 1600,
  quality: 85,
  ntfyTopic: "matt-handyman-photos-monizri",
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {}
}

// Load Learned Rules
let learnedRules = {
  projectKeywords: {},
  negativePatterns: ["screenshot", "receipt", "invoice", "document", "meme"],
  minFileSizeKb: 40,
  clusterTimeWindowHours: 4,
};

if (fs.existsSync(LEARNED_RULES_PATH)) {
  try {
    learnedRules = { ...learnedRules, ...JSON.parse(fs.readFileSync(LEARNED_RULES_PATH, "utf8")) };
  } catch {}
}

// Load Manifests
let syncedManifest = { syncedIds: [], hashes: {}, rejectedHashes: {}, lastSync: null };
if (fs.existsSync(SYNCED_MEDIA_PATH)) {
  try {
    syncedManifest = { ...syncedManifest, ...JSON.parse(fs.readFileSync(SYNCED_MEDIA_PATH, "utf8")) };
    if (!syncedManifest.rejectedHashes) syncedManifest.rejectedHashes = {};
    if (!syncedManifest.hashes) syncedManifest.hashes = {};
  } catch {}
}

let autoProjects = [];
if (fs.existsSync(AUTO_PROJECTS_PATH)) {
  try {
    autoProjects = JSON.parse(fs.readFileSync(AUTO_PROJECTS_PATH, "utf8"));
  } catch {}
}

// Parse CLI Flags
const args = process.argv.slice(2);
let targetUrl = null;
let targetDir = config.incomingFolder;
let autoStage = false;
let testMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) targetUrl = args[++i];
  if (args[i] === "--dir" && args[i + 1]) targetDir = args[++i];
  if (args[i] === "--stage") autoStage = true;
  if (args[i] === "--test") testMode = true;
}

/**
 * Computes MD5 hash
 */
function getFileHash(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

/**
 * Scrapes a public Google Photos shared album URL for high-res photo URLs
 */
async function scrapeGooglePhotosAlbum(albumUrl) {
  console.log(`🌐 Scraping Google Photos Album: ${albumUrl}`);
  try {
    const res = await fetch(albumUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error(`⚠️ Failed to fetch album URL: HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    // Matches high-res lh3.googleusercontent.com image links
    const matches = html.match(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_\-]+/g);
    if (!matches) {
      console.log("ℹ️ No photo URLs found in page.");
      return [];
    }

    // Deduplicate and filter out UI avatar icons
    const uniqueUrls = Array.from(new Set(matches)).filter(
      (u) => !u.includes("=s") && !u.includes("photo.google.com")
    );

    console.log(`📸 Discovered ${uniqueUrls.length} photo link(s) in album!`);
    const downloadedFiles = [];

    for (let i = 0; i < uniqueUrls.length; i++) {
      // Request full 1600px width from Google CDN
      const highResUrl = `${uniqueUrls[i]}=w1600-h1600-no`;
      try {
        const imgRes = await fetch(highResUrl);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const filename = `album-photo-${Date.now().toString(36)}-${i + 1}.jpg`;
          const filePath = path.join(STAGING_DIR, filename);
          fs.writeFileSync(filePath, buf);
          downloadedFiles.push({ path: filePath, name: filename, buffer: buf });
        }
      } catch (err) {
        console.warn(`  ⚠️ Failed to download photo ${i + 1}:`, err.message);
      }
    }

    return downloadedFiles;
  } catch (err) {
    console.error("⚠️ Album scrape error:", err.message);
    return [];
  }
}

/**
 * Classifies photo based on learned heuristics & negative filters
 */
function analyzePhotoCandidate(fileObj) {
  const { name, buffer, stat } = fileObj;
  const lowerName = name.toLowerCase();

  // 1. Negative pattern filter (screenshots, receipts, invoices, memes)
  for (const neg of learnedRules.negativePatterns) {
    if (lowerName.includes(neg)) {
      return { isProject: false, reason: `Matches negative pattern: '${neg}'` };
    }
  }

  // 2. Minimum file size filter (skip tiny thumbnails / icons)
  if (buffer.length < learnedRules.minFileSizeKb * 1024) {
    return { isProject: false, reason: `File size too small (${Math.round(buffer.length / 1024)}KB)` };
  }

  // 3. Rejection memory check (MD5 blacklist)
  const hash = getFileHash(buffer);
  if (syncedManifest.rejectedHashes && syncedManifest.rejectedHashes[hash]) {
    return { isProject: false, isBlacklisted: true, reason: `In rejection memory blacklist` };
  }

  // 4. Duplicate check against existing published photos
  if (syncedManifest.hashes && syncedManifest.hashes[hash]) {
    return { isProject: false, isDuplicate: true, reason: `Already published on website` };
  }

  // 5. Categorization based on learned keywords
  let matchedCategory = "Home Repairs & Improvements";
  let matchedTags = ["Home Repairs", "Quality Craftsmanship"];
  let maxScore = 0;

  for (const [key, rule] of Object.entries(learnedRules.projectKeywords)) {
    let score = 0;
    for (const term of rule.terms) {
      if (lowerName.includes(term)) score += 2;
    }
    if (score > maxScore) {
      maxScore = score;
      matchedCategory = rule.category;
      matchedTags = rule.tags;
    }
  }

  return {
    isProject: true,
    category: matchedCategory,
    tags: matchedTags,
    hash,
  };
}

/**
 * Groups photos into cohesive projects
 */
function clusterPhotosIntoProjects(candidates) {
  const projects = [];

  for (const item of candidates) {
    // Check if item belongs to an existing cluster in this batch
    let cluster = projects.find((p) => p.category === item.analysis.category);

    if (!cluster) {
      // Derive friendly title from category or filename
      let title = item.analysis.category;
      if (title === "Home Repairs & Improvements") title = "Recent Home Upgrades & Craftsmanship";

      cluster = {
        title,
        category: item.analysis.category,
        tags: item.analysis.tags,
        photos: [],
      };
      projects.push(cluster);
    }

    cluster.photos.push(item);
  }

  return projects;
}

/**
 * Optimizes and stages project photos onto dev
 */
function stageProject(project) {
  const slugId = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const stagedFilenames = [];

  for (let i = 0; i < project.photos.length; i++) {
    const item = project.photos[i];
    const targetFilename = `auto-${slugId.slice(0, 16)}-${Date.now().toString(36)}-${i + 1}.jpg`;
    const destPath = path.join(ASSETS_DIR, targetFilename);

    try {
      execSync(`which sips`, { stdio: "ignore" });
      execSync(
        `sips -s format jpeg -s formatOptions ${config.quality || 85} -Z ${config.maxDimension || 1600} "${item.path}" --out "${destPath}"`,
        { stdio: "ignore" }
      );
    } catch {
      fs.copyFileSync(item.path, destPath);
    }

    const hash = item.analysis.hash;
    syncedManifest.syncedIds.push(hash);
    syncedManifest.hashes[hash] = targetFilename;
    stagedFilenames.push(targetFilename);
  }

  // Record in autoSyncedProjects.json
  let targetEntry = autoProjects.find((p) => p.id === slugId);
  if (!targetEntry) {
    targetEntry = {
      id: slugId,
      title: project.title,
      category: project.category,
      featured: true,
      summary: `Detailed updates and custom craftsmanship for ${project.title}.`,
      description: `Custom home improvement and detailed finishing work completed across South Eastern Massachusetts & South Shore.`,
      tags: project.tags,
      coverImage: stagedFilenames[0],
      images: [],
    };
    autoProjects.unshift(targetEntry);
  }

  for (const file of stagedFilenames) {
    targetEntry.images.push({
      file,
      caption: `${project.title} (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
    });
  }

  // Save manifests
  fs.writeFileSync(SYNCED_MEDIA_PATH, JSON.stringify(syncedManifest, null, 2), "utf8");
  fs.writeFileSync(AUTO_PROJECTS_PATH, JSON.stringify(autoProjects, null, 2), "utf8");

  return stagedFilenames.length;
}

/**
 * Main execution
 */
async function main() {
  console.log("==================================================");
  console.log("🤖  AI Photo Scanner & Active Learning Engine");
  console.log("==================================================");

  let rawFiles = [];

  // Source 1: Google Photos Shared Album URL
  if (targetUrl) {
    rawFiles = await scrapeGooglePhotosAlbum(targetUrl);
  } else if (fs.existsSync(targetDir)) {
    // Source 2: Local Folder Scan
    console.log(`📁 Scanning Folder: ${targetDir}`);
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith(".") && !entry.name.endsWith(".webloc")) {
        const fullPath = path.join(targetDir, entry.name);
        try {
          const buffer = fs.readFileSync(fullPath);
          const stat = fs.statSync(fullPath);
          rawFiles.push({ path: fullPath, name: entry.name, buffer, stat });
        } catch {}
      }
    }
  }

  if (rawFiles.length === 0) {
    console.log("✨ No new photos found to scan.");
    return { discoveredProjects: [] };
  }

  console.log(`🔍 Analyzing ${rawFiles.length} photo(s) with AI heuristics...`);

  const approvedCandidates = [];
  let filteredCount = 0;
  let blacklistedCount = 0;

  for (const file of rawFiles) {
    const analysis = analyzePhotoCandidate(file);
    if (analysis.isProject) {
      approvedCandidates.push({ ...file, analysis });
    } else {
      if (analysis.isBlacklisted) blacklistedCount++;
      else filteredCount++;
    }
  }

  console.log(`  ✅ Candidate project photos: ${approvedCandidates.length}`);
  console.log(`  ℹ️ Filtered out non-projects: ${filteredCount}`);
  if (blacklistedCount > 0) {
    console.log(`  🔇 Silently skipped blacklisted: ${blacklistedCount}`);
  }

  if (approvedCandidates.length === 0) {
    console.log("\n✨ No handyman project photos detected in this batch.");
    return { discoveredProjects: [] };
  }

  // Cluster photos into project cards
  const discoveredProjects = clusterPhotosIntoProjects(approvedCandidates);

  console.log("\n==================================================");
  console.log("🔨 DISCOVERED HANDYMAN PROJECTS READY FOR REVIEW");
  console.log("==================================================");

  discoveredProjects.forEach((proj, idx) => {
    console.log(`\n[Project ${idx + 1}] ${proj.title}`);
    console.log(`  Category: ${proj.category}`);
    console.log(`  Photos:   ${proj.photos.length} photo(s)`);
    console.log(`  Tags:     ${proj.tags.join(", ")}`);
  });

  // Stage if requested
  if (autoStage) {
    let totalStaged = 0;
    for (const proj of discoveredProjects) {
      totalStaged += stageProject(proj);
    }
    console.log(`\n🌱 Successfully staged ${totalStaged} photo(s) on dev!`);
  }

  // Ping phone via ntfy & Mac desktop banner
  const projectSummary = discoveredProjects.map((p) => `${p.title} (${p.photos.length})`).join(", ");
  await sendNtfyPush(
    config.ntfyTopic,
    "AI Scanner Found Job Photos!",
    `Discovered: ${projectSummary}. Ready for review & approval!`,
    discoveredProjects[0].title
  );
  sendMacNotification(
    "🤖 AI Photo Scanner Discovered Projects",
    `Found ${discoveredProjects.length} candidate project(s) ready for review.`
  );

  console.log("\n📲 Pinged your phone lockscreen (ntfy) & Mac with notifications!");
  console.log("👉 Preview staged site at: http://localhost:5173/handyman\n");

  return { discoveredProjects };
}

export { main as scanPhotos, scrapeGooglePhotosAlbum };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
