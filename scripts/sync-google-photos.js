#!/usr/bin/env node

/**
 * Handyman Website - Google Drive & Google Photos Auto-Sync Tool
 * 
 * Features:
 * - Scans Google Drive "Handy Projects Photos" folder and subfolders.
 * - Subfolders automatically become distinct, beautifully formatted Project Cards!
 * - Automatic category & tag detection from folder names (Bathroom, Carpentry, Outdoor, etc.).
 * - Permanent Rejection Memory: MD5 blacklist in syncedMedia.json ensures rejected photos are never asked about again.
 * - Intelligent duplicate detection against all existing photos on the website.
 * - Interactive duplicate prompt in terminal ([1] Skip, [2] Add Anyway, [3] Replace, [4] Reject & Never Ask Again).
 * - Converts Apple HEIC and raw camera photos to web-optimized JPEG using native macOS sips.
 * - Automatically moves processed originals to _processed/ and rejected photos to _processed/rejected/.
 * - Supports staging mode for approval before production deployment.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// Paths
const CONFIG_PATH = path.join(ROOT_DIR, "photo-sync.config.json");
const ASSETS_DIR = path.join(ROOT_DIR, "src", "assets", "handyman");
const SYNCED_MEDIA_PATH = path.join(ROOT_DIR, "src", "data", "syncedMedia.json");
const AUTO_PROJECTS_PATH = path.join(ROOT_DIR, "src", "data", "autoSyncedProjects.json");
const TEMP_DIR = path.join(ROOT_DIR, ".tmp_photos");

// Ensure base directories exist
fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Load Configuration
let config = {
  incomingFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos",
  archiveFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos/_processed",
  rejectedFolder: "/Users/matthewmoniz/Library/CloudStorage/GoogleDrive-monizri@gmail.com/My Drive/Handy Projects Photos/_processed/rejected",
  fallbackFolder: "./incoming-photos",
  maxDimension: 1600,
  quality: 85,
  autoDeploy: false,
  archiveProcessed: true,
  ntfyTopic: "matt-handyman-photos-monizri",
  notifyEmail: "monizri@gmail.com",
  albums: [],
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch (err) {
    console.warn("⚠️ Failed to parse photo-sync.config.json, using defaults.", err.message);
  }
}

// Parse CLI Flags
const args = process.argv.slice(2);
let cliUrl = null;
let cliCategory = null;
let cliTitle = null;
let forceDeploy = config.autoDeploy;
let interactive = process.stdin.isTTY;
let dryRun = false;
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) cliUrl = args[++i];
  if (args[i] === "--category" && args[i + 1]) cliCategory = args[++i];
  if (args[i] === "--title" && args[i + 1]) cliTitle = args[++i];
  if (args[i] === "--deploy") forceDeploy = true;
  if (args[i] === "--no-deploy") forceDeploy = false;
  if (args[i] === "--non-interactive") interactive = false;
  if (args[i] === "--dry-run") dryRun = true;
  if (args[i] === "--verbose") verbose = true;
}

// Load Synced Media Manifest (with Permanent Rejection Blacklist)
let syncedManifest = { syncedIds: [], hashes: {}, rejectedHashes: {}, lastSync: null, totalSynced: 0 };
if (fs.existsSync(SYNCED_MEDIA_PATH)) {
  try {
    syncedManifest = { ...syncedManifest, ...JSON.parse(fs.readFileSync(SYNCED_MEDIA_PATH, "utf8")) };
    if (!Array.isArray(syncedManifest.syncedIds)) syncedManifest.syncedIds = [];
    if (!syncedManifest.hashes) syncedManifest.hashes = {};
    if (!syncedManifest.rejectedHashes) syncedManifest.rejectedHashes = {};
  } catch (err) {
    console.warn("⚠️ Failed to parse syncedMedia.json, reinitializing.", err.message);
  }
}

// Load Auto-Synced Projects
let autoProjects = [];
if (fs.existsSync(AUTO_PROJECTS_PATH)) {
  try {
    autoProjects = JSON.parse(fs.readFileSync(AUTO_PROJECTS_PATH, "utf8"));
    if (!Array.isArray(autoProjects)) autoProjects = [];
  } catch (err) {
    console.warn("⚠️ Failed to parse autoSyncedProjects.json, reinitializing.", err.message);
  }
}

/**
 * Computes MD5 hash of a file or buffer
 */
function getFileHash(filePathOrBuffer) {
  const buf = Buffer.isBuffer(filePathOrBuffer) ? filePathOrBuffer : fs.readFileSync(filePathOrBuffer);
  return crypto.createHash("md5").update(buf).digest("hex");
}

/**
 * Checks if a photo has been previously rejected by the user
 */
function isPhotoRejected(fileBuf) {
  const hash = getFileHash(fileBuf);
  return {
    isRejected: Boolean(syncedManifest.rejectedHashes && syncedManifest.rejectedHashes[hash]),
    hash,
  };
}

/**
 * Builds an index of all existing assets on the website to detect duplicates
 */
function buildExistingAssetsIndex() {
  const index = new Map();
  if (!fs.existsSync(ASSETS_DIR)) return index;

  const files = fs.readdirSync(ASSETS_DIR).filter((f) => /\.(jpg|jpeg|png|webp|JPG|JPEG|PNG|WEBP)$/.test(f));
  for (const file of files) {
    try {
      const fullPath = path.join(ASSETS_DIR, file);
      const stat = fs.statSync(fullPath);
      const hash = getFileHash(fullPath);

      index.set(file, {
        filename: file,
        size: stat.size,
        hash,
      });
    } catch {}
  }
  return index;
}

const existingAssetsIndex = buildExistingAssetsIndex();

/**
 * Checks if an incoming image file is a duplicate of any existing photo on the website
 */
function checkDuplicate(incomingBuffer, incomingName) {
  const incomingHash = crypto.createHash("md5").update(incomingBuffer).digest("hex");

  // 1. Direct hash match in existing assets
  for (const [existingFilename, asset] of existingAssetsIndex.entries()) {
    if (asset.hash === incomingHash) {
      return { isDuplicate: true, matchedFile: existingFilename, hash: incomingHash, reason: "exact content hash match" };
    }
  }

  // 2. Check previously synced IDs/hashes
  if (syncedManifest.syncedIds.includes(incomingHash)) {
    return { isDuplicate: true, matchedFile: syncedManifest.hashes[incomingHash] || "previously synced", hash: incomingHash, reason: "already synced" };
  }

  return { isDuplicate: false, hash: incomingHash };
}

/**
 * Prompt user in terminal when duplicate is detected
 */
async function promptDuplicateAction(incomingName, matchedFile, fileHash) {
  if (!interactive) {
    console.log(`⚠️  [DUPLICATE DETECTED] '${incomingName}' matches existing '${matchedFile}'. Automatically skipping.`);
    return "skip";
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n==================================================");
    console.log(`⚠️  DUPLICATE DETECTED`);
    console.log(`==================================================`);
    console.log(`  Incoming photo: '${incomingName}'`);
    console.log(`  Matches existing: '${matchedFile}' on the website.`);
    console.log(`\n👉 What would you like to do?`);
    console.log(`   [1] Skip this photo (keep gallery clean)`);
    console.log(`   [2] Add anyway as a separate photo`);
    console.log(`   [3] Replace existing photo with this version`);
    console.log(`   [4] Reject & Never Ask Again (permanent blacklist)`);

    rl.question(`Choice (1/2/3/4) [default: 1]: `, (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === "2") resolve("add");
      else if (choice === "3") resolve("replace");
      else if (choice === "4") resolve("blacklist");
      else resolve("skip");
    });
  });
}

/**
 * Detects Category and Suggested Tags from Folder Name
 */
function detectCategoryAndTags(folderName) {
  const name = folderName.toLowerCase();

  if (/bath|vanity|sink|toilet|faucet|plumb|shower|tile/.test(name)) {
    return {
      category: "Bathroom Remodel",
      tags: ["Bathroom Updates", "Plumbing Fixtures", "Vanity Install", "Tile & Caulking"],
    };
  }
  if (/stair|tread|rail|wood|carpenter|cabinet|trim|molding|shelf|door|deck|pergola/.test(name)) {
    if (/deck|pergola|porch/.test(name)) {
      return {
        category: "Outdoor & Garden",
        tags: ["Outdoor Carpentry", "Rot-Resistant Lumber", "Custom Decking"],
      };
    }
    return {
      category: "Custom Carpentry",
      tags: ["Custom Woodwork", "Finish Carpentry", "Precision Joinery"],
    };
  }
  if (/garden|bed|outdoor|fence|gate|patio|shed|yard/.test(name)) {
    return {
      category: "Outdoor & Garden",
      tags: ["Outdoor Carpentry", "Rot-Resistant Lumber", "Protective Enclosure"],
    };
  }
  return {
    category: "Home Repairs & Improvements",
    tags: ["Home Repairs", "Maintenance", "Quality Craftsmanship"],
  };
}

/**
 * Optimizes an image using macOS native sips
 */
function processAndOptimizeImage(srcPath, destFilename, maxDim = 1600, quality = 85) {
  const destPath = path.join(ASSETS_DIR, destFilename);
  try {
    execSync(`which sips`, { stdio: "ignore" });
    execSync(
      `sips -s format jpeg -s formatOptions ${quality} -Z ${maxDim} "${srcPath}" --out "${destPath}"`,
      { stdio: "ignore" }
    );
  } catch {
    fs.copyFileSync(srcPath, destPath);
  }
  return destFilename;
}

/**
 * Process new photos into the website's project schema
 */
function recordPhotosInProject(projectMeta, newPhotoFilenames) {
  const projectId = projectMeta.id || "recent-work";
  let targetProject = autoProjects.find((p) => p.id === projectId);

  if (!targetProject) {
    targetProject = {
      id: projectId,
      title: projectMeta.title || "Recent Jobsite Work",
      category: projectMeta.category || "Recent Work",
      featured: true,
      summary: projectMeta.summary || `Quality craftsmanship completed for ${projectMeta.title || "client home improvement"}.`,
      description:
        projectMeta.description ||
        `Custom home improvement and detailed finishing work completed across South Eastern Massachusetts & South Shore.`,
      tags: projectMeta.tags || ["Recent Work", "Home Repair"],
      coverImage: newPhotoFilenames[0],
      images: [],
    };
    autoProjects.unshift(targetProject);
  }

  // Prepend new images to project
  const existingFiles = new Set(targetProject.images.map((img) => img.file));
  for (const file of newPhotoFilenames) {
    if (!existingFiles.has(file)) {
      targetProject.images.unshift({
        file,
        caption: `${projectMeta.title || "Job photo"} (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
      });
      existingFiles.add(file);
    }
  }

  // Keep coverImage fresh
  if (targetProject.images.length > 0) {
    targetProject.coverImage = targetProject.images[0].file;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("==================================================");
  console.log("🛠️  Handyman Website Auto-Sync & Optimizer");
  console.log("==================================================");

  let newPhotosAdded = [];
  const processedFilesToMove = [];
  const rejectedFilesToMove = [];
  let stagedProjectsSummary = [];

  // Determine Google Drive folder (fall back to repo-local incoming-photos when running in CI)
  const hasDriveFolder = config.incomingFolder && fs.existsSync(config.incomingFolder);
  const activeIncomingDir = hasDriveFolder
    ? config.incomingFolder
    : path.resolve(ROOT_DIR, config.fallbackFolder || "incoming-photos");

  const archiveDir =
    hasDriveFolder && config.archiveFolder
      ? config.archiveFolder
      : path.join(activeIncomingDir, "_processed");
  const rejectedDir =
    hasDriveFolder && config.rejectedFolder
      ? config.rejectedFolder
      : path.join(archiveDir, "rejected");

  if (!dryRun && fs.existsSync(activeIncomingDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.mkdirSync(rejectedDir, { recursive: true });
  }

  console.log(`📁 Scanning Folder: ${activeIncomingDir}`);

  if (fs.existsSync(activeIncomingDir)) {
    const entries = fs.readdirSync(activeIncomingDir, { withFileTypes: true });

    // Group 1: Subfolders (Each subfolder becomes its own project card!)
    const subdirectories = entries.filter(
      (e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "_processed"
    );

    for (const dir of subdirectories) {
      const folderName = dir.name;
      const subDirPath = path.join(activeIncomingDir, folderName);
      const subFiles = fs
        .readdirSync(subDirPath)
        .filter((f) => /\.(jpg|jpeg|png|heic|webp|JPG|JPEG|PNG|HEIC|WEBP)$/.test(f));

      if (subFiles.length === 0) continue;

      const { category, tags } = detectCategoryAndTags(folderName);
      const rawSlug = folderName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const CURATED_PROJECT_ALIASES = {
        "staircase": "custom-staircase",
        "stairs": "custom-staircase",
        "custom-staircase": "custom-staircase",
        "hardwood-staircase": "custom-staircase",
        "vanity": "custom-double-vanity",
        "double-vanity": "custom-double-vanity",
        "bathroom-vanity": "custom-double-vanity",
        "custom-double-vanity": "custom-double-vanity",
        "garden-beds": "raised-garden-beds",
        "raised-garden-beds": "raised-garden-beds",
        "raised-beds": "raised-garden-beds",
        "garden": "raised-garden-beds",
        "downstairs-bathroom": "downstairs-bathroom",
        "half-bath": "downstairs-bathroom",
        "play-area": "kids-play-area",
        "kids-play-area": "kids-play-area",
      };
      const slugId = CURATED_PROJECT_ALIASES[rawSlug] || rawSlug;

      const projectMeta = {
        id: slugId,
        title: folderName,
        category,
        tags,
        summary: `Craftsmanship and detailed updates for ${folderName}.`,
      };

      const projectNewFiles = [];

      for (let i = 0; i < subFiles.length; i++) {
        const file = subFiles[i];
        const srcPath = path.join(subDirPath, file);
        const fileBuf = fs.readFileSync(srcPath);

        // 1. Permanent Rejection Memory Check (FIRST check: completely silent if blacklisted)
        const rejCheck = isPhotoRejected(fileBuf);
        if (rejCheck.isRejected) {
          if (verbose) {
            console.log(`  ℹ️ [Suppressed] '${file}' was previously rejected. Silently skipping.`);
          }
          rejectedFilesToMove.push({ srcPath, file });
          continue;
        }

        // 2. Duplicate Check
        const dupCheck = checkDuplicate(fileBuf, file);
        if (dupCheck.isDuplicate) {
          const action = await promptDuplicateAction(`${folderName}/${file}`, dupCheck.matchedFile, dupCheck.hash);
          if (action === "blacklist") {
            syncedManifest.rejectedHashes[dupCheck.hash] = {
              filename: file,
              folder: folderName,
              rejectedAt: new Date().toISOString(),
            };
            rejectedFilesToMove.push({ srcPath, file });
            console.log(`  🚫 Blacklisted: '${file}' added to rejection memory.`);
            continue;
          }
          if (action === "skip") {
            continue;
          }
        }

        const safeSlug = slugId.slice(0, 20);
        const targetFilename = `auto-${safeSlug}-${Date.now().toString(36)}-${i + 1}.jpg`;

        if (!dryRun) {
          processAndOptimizeImage(srcPath, targetFilename, config.maxDimension, config.quality);
        }

        const hash = getFileHash(fileBuf);
        syncedManifest.syncedIds.push(hash);
        syncedManifest.hashes[hash] = targetFilename;

        projectNewFiles.push(targetFilename);
        newPhotosAdded.push(targetFilename);
        processedFilesToMove.push({ srcPath, dirPath: subDirPath, file, folderName });
        console.log(`  ✅ Processed: ${file} ➔ ${targetFilename}`);
      }

      if (projectNewFiles.length > 0) {
        if (!dryRun) {
          recordPhotosInProject(projectMeta, projectNewFiles);
        }
        stagedProjectsSummary.push({
          title: folderName,
          category,
          count: projectNewFiles.length,
        });
      }
    }

    // Group 2: Loose photos in root folder (Recent Work showcase)
    const looseFiles = entries.filter(
      (e) => e.isFile() && /\.(jpg|jpeg|png|heic|webp|JPG|JPEG|PNG|HEIC|WEBP)$/.test(e.name)
    );

    if (looseFiles.length > 0) {
      const looseNewFiles = [];

      for (let i = 0; i < looseFiles.length; i++) {
        const file = looseFiles[i].name;
        const srcPath = path.join(activeIncomingDir, file);
        const fileBuf = fs.readFileSync(srcPath);

        // 1. Permanent Rejection Memory Check
        const rejCheck = isPhotoRejected(fileBuf);
        if (rejCheck.isRejected) {
          if (verbose) {
            console.log(`  ℹ️ [Suppressed] '${file}' was previously rejected. Silently skipping.`);
          }
          rejectedFilesToMove.push({ srcPath, file });
          continue;
        }

        // 2. Duplicate Check
        const dupCheck = checkDuplicate(fileBuf, file);
        if (dupCheck.isDuplicate) {
          const action = await promptDuplicateAction(file, dupCheck.matchedFile, dupCheck.hash);
          if (action === "blacklist") {
            syncedManifest.rejectedHashes[dupCheck.hash] = {
              filename: file,
              folder: "root",
              rejectedAt: new Date().toISOString(),
            };
            rejectedFilesToMove.push({ srcPath, file });
            console.log(`  🚫 Blacklisted: '${file}' added to rejection memory.`);
            continue;
          }
          if (action === "skip") {
            continue;
          }
        }

        const targetFilename = `auto-work-${Date.now().toString(36)}-${i + 1}.jpg`;
        if (!dryRun) {
          processAndOptimizeImage(srcPath, targetFilename, config.maxDimension, config.quality);
        }

        const hash = getFileHash(fileBuf);
        syncedManifest.syncedIds.push(hash);
        syncedManifest.hashes[hash] = targetFilename;

        looseNewFiles.push(targetFilename);
        newPhotosAdded.push(targetFilename);
        processedFilesToMove.push({ srcPath, dirPath: activeIncomingDir, file, folderName: null });
        console.log(`  ✅ Processed loose photo: ${file} ➔ ${targetFilename}`);
      }

      if (looseNewFiles.length > 0) {
        if (!dryRun) {
          recordPhotosInProject(
            {
              id: "recent-work",
              title: "Recent Jobsite Work & Upgrades",
              category: "Recent Work",
            },
            looseNewFiles
          );
        }
        stagedProjectsSummary.push({
          title: "Recent Jobsite Work & Upgrades",
          category: "Recent Work",
          count: looseNewFiles.length,
        });
      }
    }
  }

  // Move rejected files to _processed/rejected/
  if (rejectedFilesToMove.length > 0 && !dryRun) {
    for (const item of rejectedFilesToMove) {
      try {
        const dest = path.join(rejectedDir, `${Date.now()}_${item.file}`);
        fs.renameSync(item.srcPath, dest);
      } catch {}
    }
  }

  // Move processed files to _processed/ subfolder so Drive stays clean
  if (config.archiveProcessed && processedFilesToMove.length > 0 && !dryRun) {
    for (const item of processedFilesToMove) {
      try {
        let dest;
        if (item.folderName) {
          const projectArchiveDir = path.join(archiveDir, item.folderName);
          fs.mkdirSync(projectArchiveDir, { recursive: true });
          dest = path.join(projectArchiveDir, item.file);
        } else {
          dest = path.join(archiveDir, `${Date.now()}_${item.file}`);
        }
        fs.renameSync(item.srcPath, dest);
      } catch {}
    }

    // Clean up empty processed subfolders in incoming
    try {
      const entries = fs.readdirSync(activeIncomingDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && e.name !== "_processed" && !e.name.startsWith(".")) {
          const fullDir = path.join(activeIncomingDir, e.name);
          const remaining = fs.readdirSync(fullDir);
          if (remaining.length === 0) {
            fs.rmdirSync(fullDir);
          }
        }
      }
    } catch {}
  }

  // Save manifests
  if ((newPhotosAdded.length > 0 || rejectedFilesToMove.length > 0) && !dryRun) {
    syncedManifest.lastSync = new Date().toISOString();
    syncedManifest.totalSynced = syncedManifest.syncedIds.length;

    fs.writeFileSync(SYNCED_MEDIA_PATH, JSON.stringify(syncedManifest, null, 2), "utf8");
    fs.writeFileSync(AUTO_PROJECTS_PATH, JSON.stringify(autoProjects, null, 2), "utf8");

    if (newPhotosAdded.length > 0) {
      console.log(`\n🎉 Successfully synced ${newPhotosAdded.length} new photo(s) to the website!`);
    }

    // Git Commit & Deploy (if --deploy is specified)
    if (forceDeploy && newPhotosAdded.length > 0) {
      console.log("\n🚀 Initiating Git push to deploy live on Netlify...");
      try {
        execSync(`git add src/assets/handyman/ src/data/autoSyncedProjects.json src/data/syncedMedia.json`, {
          cwd: ROOT_DIR,
          stdio: "inherit",
        });

        const commitMsg = `Auto-sync ${newPhotosAdded.length} handyman photos [skip ci]`;
        execSync(`git commit -m "${commitMsg}"`, { cwd: ROOT_DIR, stdio: "inherit" });
        execSync(`git push origin main`, { cwd: ROOT_DIR, stdio: "inherit" });

        console.log("\n✨ Deployed! Netlify will update https://mattmoniz.io/handyman in ~30 seconds.");
      } catch (err) {
        console.error("⚠️ Git auto-deploy failed:", err.message);
      }
    } else if (newPhotosAdded.length > 0) {
      console.log("\n🌱 Staged locally on dev! Preview at http://localhost:5173/handyman");
      console.log("   (Run 'npm run approve-photos' when you are ready to publish live).");
    }
  } else if (newPhotosAdded.length === 0) {
    console.log("\n✨ No new photos found to sync. Everything is up to date!");
  }

  // Cleanup temp
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch {}

  // Output JSON summary for daemon watcher if requested
  return {
    newPhotosCount: newPhotosAdded.length,
    rejectedCount: rejectedFilesToMove.length,
    stagedProjects: stagedProjectsSummary,
  };
}

// Export for programmatic use by watch daemon
export { main as syncPhotos, isPhotoRejected, getFileHash };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
