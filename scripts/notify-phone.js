#!/usr/bin/env node

/**
 * Handyman Website - Multi-Channel Phone & Desktop Notification Dispatcher
 * 
 * Channels:
 * 1. ntfy.sh lockscreen push notification with 1-tap action buttons ([Proceed & Deploy], [View Preview], [Reject])
 * 2. Native macOS desktop banner & sound
 * 3. Terminal & Antigravity chat summary
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "photo-sync.config.json");

let config = {
  ntfyTopic: "matt-handyman-photos-monizri",
  notifyEmail: "monizri@gmail.com",
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch {}
}

// Parse args
const args = process.argv.slice(2);
let projectTitle = "Recent Jobsite Work";
let photoCount = 1;
let category = "Recent Work";
let isTest = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--project" && args[i + 1]) projectTitle = args[++i];
  if (args[i] === "--photos" && args[i + 1]) photoCount = parseInt(args[++i], 10);
  if (args[i] === "--category" && args[i + 1]) category = args[++i];
  if (args[i] === "--test") isTest = true;
}

if (isTest) {
  projectTitle = "Custom Cedar Deck Build (Test)";
  photoCount = 3;
  category = "Outdoor & Garden";
}

/**
 * Dispatches lockscreen push notification via ntfy.sh
 */
async function sendNtfyPush(topic, title, body, project) {
  const url = `https://ntfy.sh/${topic}`;

  // In ntfy, HTTP headers must be ASCII; emojis are specified via Tags header or body
  const previewUrl = "http://localhost:5173/handyman";
  const actionsHeader = `view, Preview Staged Site, ${previewUrl}; view, Approve and Deploy, https://mattmoniz.io/handyman`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Title": title.replace(/[^\x00-\x7F]/g, "").trim(),
        "Priority": "high",
        "Tags": "hammer_and_wrench,house",
        "Actions": actionsHeader,
      },
      body: body,
    });

    if (res.ok) {
      console.log(`  📱 Phone Push: Sent via ntfy.sh/${topic}`);
      return true;
    } else {
      console.warn(`  ⚠️ Phone Push warning: ntfy returned status ${res.status}`);
    }
  } catch (err) {
    console.warn(`  ⚠️ Phone Push failed:`, err.message);
  }
  return false;
}

/**
 * Dispatches native macOS desktop banner
 */
function sendMacNotification(title, message) {
  try {
    const escapedMsg = message.replace(/"/g, '\\"');
    const escapedTitle = title.replace(/"/g, '\\"');
    execSync(
      `osascript -e 'display notification "${escapedMsg}" with title "${escapedTitle}" sound name "Glass"'`
    );
    console.log(`  💻 Mac Banner: Fired desktop notification.`);
    return true;
  } catch (err) {
    console.warn(`  ⚠️ Mac Banner failed:`, err.message);
  }
  return false;
}

/**
 * Main dispatcher
 */
async function notifyAll(options = {}) {
  const pTitle = options.projectTitle || projectTitle;
  const pCount = options.photoCount || photoCount;
  const pCat = options.category || category;

  const headerTitle = "🛠️ Handyman Photos Ready for Review";
  const messageBody = `${pCount} new photo(s) staged for "${pTitle}" (${pCat}). Ready for your review & approval!`;

  console.log("\n==================================================");
  console.log("📲 Dispatching Multi-Channel Notifications");
  console.log("==================================================");
  console.log(`  Project: ${pTitle}`);
  console.log(`  Photos:  ${pCount}`);
  console.log(`  Category: ${pCat}`);
  console.log("--------------------------------------------------");

  // 1. Phone Lockscreen Push (ntfy)
  await sendNtfyPush(config.ntfyTopic, headerTitle, messageBody, pTitle);

  // 2. Mac Desktop Banner & Sound
  sendMacNotification(headerTitle, messageBody);

  console.log("--------------------------------------------------");
  console.log("👉 On your phone: Open 'ntfy' app (subscribed to '" + config.ntfyTopic + "').");
  console.log("👉 On your Mac:   Run 'npm run approve-photos' or click Approve in chat.");
  console.log("==================================================\n");
}

export { notifyAll, sendNtfyPush, sendMacNotification };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  notifyAll().catch(console.error);
}
