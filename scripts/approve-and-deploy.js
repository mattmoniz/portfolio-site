#!/usr/bin/env node

/**
 * Handyman Website - One-Click Approval & Production Deployment
 * 
 * Commits staged photos and project cards to git, pushes to origin main,
 * and triggers Netlify Edge deployment.
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { sendNtfyPush, sendMacNotification } from "./notify-phone.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

console.log("==================================================");
console.log("🚀 Approving & Deploying Handyman Photos Live");
console.log("==================================================");

try {
  // Check if there are changes to commit
  const status = execSync("git status --porcelain src/assets/handyman src/data/autoSyncedProjects.json src/data/syncedMedia.json", {
    cwd: ROOT_DIR,
    encoding: "utf8",
  }).trim();

  if (!status) {
    console.log("ℹ️ No staged photo changes detected to deploy. Everything is already up to date.");
    process.exit(0);
  }

  console.log("📦 Staging updated assets & project metadata...");
  execSync("git add src/assets/handyman/ src/data/autoSyncedProjects.json src/data/syncedMedia.json", {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });

  const commitMsg = `Publish approved handyman projects [skip ci]`;
  console.log(`📝 Creating commit: "${commitMsg}"...`);
  execSync(`git commit -m "${commitMsg}"`, { cwd: ROOT_DIR, stdio: "inherit" });

  console.log("🌐 Pushing to GitHub (origin main)...");
  execSync("git push origin main", { cwd: ROOT_DIR, stdio: "inherit" });

  console.log("\n🎉 Deployment triggered successfully!");
  console.log("👉 Netlify is now building and publishing your live site in ~30 seconds.");
  console.log("👉 Live URL: https://mattmoniz.io/handyman");

  // Notifications
  sendMacNotification(
    "✅ Handyman Photos Deployed!",
    "Your approved projects are publishing live to mattmoniz.io/handyman."
  );
  sendNtfyPush(
    "matt-handyman-photos-monizri",
    "✅ Handyman Photos Published!",
    "Your approved projects are publishing live to mattmoniz.io/handyman in ~30s."
  );
} catch (err) {
  console.error("❌ Approval deployment failed:", err.message);
  process.exit(1);
}
