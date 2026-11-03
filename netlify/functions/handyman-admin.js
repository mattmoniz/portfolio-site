import crypto from "crypto";

const DEFAULT_ALBUM_URL = "https://photos.app.goo.gl/rzsCye2XgjAZUvW69";
const GITHUB_REPO = "mattmoniz/portfolio-site";
const GITHUB_BRANCH = "main";
const ADMIN_PIN = process.env.HANDYMAN_ADMIN_PIN || "matt2026";
const ADMIN_ALLOWED_EMAIL = process.env.ADMIN_ALLOWED_EMAIL || "monizri@gmail.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Helper for JSON responses
function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

// Scrape Google Photos shared album
async function scrapeAlbumPhotos(albumUrl) {
  try {
    const res = await fetch(albumUrl, { redirect: "follow" });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g);
    if (!matches) return [];
    return Array.from(new Set(matches)).map(
      (url) => `${url}=w1600-h1600-no`
    );
  } catch (err) {
    console.error("Album scrape error:", err.message);
    return [];
  }
}

// Fetch file from GitHub
async function getGitHubFile(path) {
  if (!GITHUB_TOKEN) return null;
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "mattmoniz-handyman-admin",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf8");
  return { sha: data.sha, content: JSON.parse(content) };
}

// Commit file to GitHub
async function updateGitHubFile(path, contentObj, commitMessage, sha) {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable is not configured in Netlify.");
  }
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const body = {
    message: commitMessage,
    content: Buffer.from(JSON.stringify(contentObj, null, 2)).toString("base64"),
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "mattmoniz-handyman-admin",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${errText}`);
  }
  return await res.json();
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }
  }

  const action = body.action || event.queryStringParameters?.action;

  // 1. Verify Google SSO ID Token
  if (action === "verify-google") {
    const { credential } = body;
    if (!credential) {
      return jsonResponse(400, { error: "Missing Google credential token" });
    }

    try {
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!googleRes.ok) {
        return jsonResponse(401, { error: "Invalid or expired Google token" });
      }

      const payload = await googleRes.json();
      if (!payload.email) {
        return jsonResponse(401, { error: "Google token did not return an email" });
      }

      if (payload.email.toLowerCase() !== ADMIN_ALLOWED_EMAIL.toLowerCase()) {
        console.warn(`[SECURITY] Unauthorized login attempt from: ${payload.email}`);
        return jsonResponse(403, {
          error: `Access Denied: ${payload.email} is not authorized. This portal is strictly restricted to ${ADMIN_ALLOWED_EMAIL}.`,
        });
      }

      const token = crypto.createHash("sha256").update(payload.email + ADMIN_PIN + "salt-2026").digest("hex");
      return jsonResponse(200, {
        authenticated: true,
        token,
        user: {
          email: payload.email,
          name: payload.name || "Matthew Moniz",
          picture: payload.picture || "",
        },
      });
    } catch (err) {
      return jsonResponse(500, { error: "Google token verification failed: " + err.message });
    }
  }

  // 2. Verify Passcode (Backup Fallback)
  if (action === "verify-auth") {
    const { passcode } = body;
    if (passcode === ADMIN_PIN) {
      const token = crypto.createHash("sha256").update(ADMIN_PIN + "salt-2026").digest("hex");
      return jsonResponse(200, { authenticated: true, token, user: { email: ADMIN_ALLOWED_EMAIL, name: "Admin" } });
    }
    return jsonResponse(401, { error: "Invalid passcode. Please try again." });
  }

  // Auth check for all other administrative actions
  const authHeader = event.headers.authorization || body.token;
  const pinToken = crypto.createHash("sha256").update(ADMIN_PIN + "salt-2026").digest("hex");
  const googleToken = crypto.createHash("sha256").update(ADMIN_ALLOWED_EMAIL + ADMIN_PIN + "salt-2026").digest("hex");
  const isAuthorized =
    authHeader === `Bearer ${pinToken}` ||
    authHeader === pinToken ||
    authHeader === `Bearer ${googleToken}` ||
    authHeader === googleToken;

  if (!isAuthorized) {
    return jsonResponse(401, { error: "Unauthorized. Session expired or invalid." });
  }

  // 2. Scan Album
  if (action === "scan-album") {
    const albumPhotos = await scrapeAlbumPhotos(body.albumUrl || DEFAULT_ALBUM_URL);
    return jsonResponse(200, {
      totalFound: albumPhotos.length,
      photos: albumPhotos,
    });
  }

  // 3. Publish Approved Projects Directly to GitHub
  if (action === "publish-live") {
    const { projects, stagedProjects } = body;
    if (!projects || !Array.isArray(projects)) {
      return jsonResponse(400, { error: "Missing or invalid 'projects' array." });
    }

    try {
      // Get current SHA of projects.json
      let fileData = await getGitHubFile("src/data/projects.json");
      const sha = fileData ? fileData.sha : null;

      const commitMsg = `Publish handyman updates from online admin (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}) [skip ci]`;
      await updateGitHubFile("src/data/projects.json", projects, commitMsg, sha);

      // Optionally update stagedProjects.json
      if (Array.isArray(stagedProjects)) {
        try {
          const stagedData = await getGitHubFile("src/data/stagedProjects.json");
          await updateGitHubFile(
            "src/data/stagedProjects.json",
            stagedProjects,
            "Update staged projects queue",
            stagedData ? stagedData.sha : null
          );
        } catch (e) {
          console.warn("Could not update stagedProjects on GitHub:", e.message);
        }
      }

      return jsonResponse(200, {
        success: true,
        message: "Successfully published to GitHub! Netlify is now building and deploying your site live in ~30 seconds.",
      });
    } catch (err) {
      console.error("Publish error:", err.message);
      return jsonResponse(500, {
        error: "Failed to publish live via GitHub API: " + err.message,
      });
    }
  }

  return jsonResponse(400, { error: `Unknown action: ${action}` });
}
