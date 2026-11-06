import crypto from "crypto";

const DEFAULT_ALBUM_URL = "https://photos.app.goo.gl/rzsCye2XgjAZUvW69";
const GITHUB_REPO = "mattmoniz/portfolio-site";
const GITHUB_BRANCH = "main";
const ADMIN_ALLOWED_EMAIL = process.env.ADMIN_ALLOWED_EMAIL || "monizri@gmail.com";
const GOOGLE_CLIENT_ID =
  process.env.VITE_GOOGLE_CLIENT_ID ||
  "963213000468-906lvvb8v8e6vo9nf7d6org2esmvaq0v.apps.googleusercontent.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const ALLOWED_ORIGINS = new Set([
  "https://mattmoniz.io",
  "https://www.mattmoniz.io",
  "http://localhost:5173",
  "http://localhost:8888",
]);

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || GITHUB_TOKEN;
  if (!secret) {
    throw new Error("Server authentication secret is not configured in environment.");
  }
  return secret;
}

function createSignedSessionToken(email) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ email: email.toLowerCase(), exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySignedSessionToken(rawToken) {
  if (!rawToken || typeof rawToken !== "string") return false;
  const clean = rawToken.replace(/^Bearer\s+/i, "").trim();
  const parts = clean.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;

  try {
    const expectedSig = crypto
      .createHmac("sha256", getSessionSecret())
      .update(payloadB64)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return false;
    }

    const data = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!data.exp || Date.now() > data.exp) return false;
    if (data.email !== ADMIN_ALLOWED_EMAIL.toLowerCase()) return false;
    return true;
  } catch {
    return false;
  }
}

// Helper for JSON responses with strict CORS
function jsonResponse(statusCode, body, requestOrigin) {
  const allowOrigin = ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : "https://mattmoniz.io";
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

// Validate & scrape Google Photos shared album (prevents SSRF by enforcing Google Photos domains)
async function scrapeAlbumPhotos(albumUrl) {
  try {
    const parsed = new URL(albumUrl);
    if (
      parsed.protocol !== "https:" ||
      (parsed.hostname !== "photos.app.goo.gl" && parsed.hostname !== "photos.google.com")
    ) {
      throw new Error("Disallowed album URL host.");
    }
    const res = await fetch(parsed.toString(), { redirect: "follow" });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_-]+/g);
    if (!matches) return [];
    return Array.from(new Set(matches)).map((url) => `${url}=w1600-h1600-no`);
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

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "";

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, { ok: true }, origin);
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" }, origin);
    }
  }

  const action = body.action || event.queryStringParameters?.action;

  // 1. Verify Google SSO ID Token
  if (action === "verify-google") {
    const { credential } = body;
    if (!credential) {
      return jsonResponse(400, { error: "Missing Google credential token" }, origin);
    }

    try {
      const googleRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );
      if (!googleRes.ok) {
        return jsonResponse(401, { error: "Invalid or expired Google token" }, origin);
      }

      const payload = await googleRes.json();
      if (!payload.email || (payload.email_verified !== "true" && payload.email_verified !== true)) {
        return jsonResponse(401, { error: "Google account email is not verified" }, origin);
      }

      if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
        return jsonResponse(401, { error: "Google token audience mismatch" }, origin);
      }

      if (payload.email.toLowerCase() !== ADMIN_ALLOWED_EMAIL.toLowerCase()) {
        console.warn(`[SECURITY] Unauthorized login attempt from: ${payload.email}`);
        return jsonResponse(
          403,
          {
            error: `Access Denied: ${payload.email} is not authorized. This portal is strictly restricted to ${ADMIN_ALLOWED_EMAIL}.`,
          },
          origin
        );
      }

      const token = createSignedSessionToken(payload.email);
      return jsonResponse(
        200,
        {
          authenticated: true,
          token,
          user: {
            email: payload.email,
            name: payload.name || "Matthew Moniz",
            picture: payload.picture || "",
          },
        },
        origin
      );
    } catch (err) {
      return jsonResponse(500, { error: "Google token verification failed: " + err.message }, origin);
    }
  }

  // Auth check for all other administrative actions (Google SSO strictly required)
  const authHeader = event.headers?.authorization || event.headers?.Authorization || body.token;
  if (!verifySignedSessionToken(authHeader)) {
    return jsonResponse(401, { error: "Unauthorized. Session expired or invalid." }, origin);
  }

  // 3. Load Latest Cloud Projects, Staged Queue & Synced Media Memory
  if (action === "load-cloud-data") {
    try {
      const [liveData, stagedData, mediaData] = await Promise.all([
        getGitHubFile("src/data/projects.json"),
        getGitHubFile("src/data/stagedProjects.json"),
        getGitHubFile("src/data/syncedMedia.json"),
      ]);
      return jsonResponse(
        200,
        {
          projects: liveData ? liveData.content : null,
          stagedProjects: stagedData ? stagedData.content : null,
          seenBaseUrls: mediaData?.content?.seenBaseUrls || [],
        },
        origin
      );
    } catch (err) {
      return jsonResponse(500, { error: "Failed to load cloud data: " + err.message }, origin);
    }
  }

  // 4. Permanently Reject Photo URLs in Cloud Memory
  if (action === "reject-photo") {
    const { urls, stagedProjects } = body;
    const urlList = Array.isArray(urls) ? urls : [];
    try {
      const mediaFile = await getGitHubFile("src/data/syncedMedia.json");
      const mediaContent = mediaFile?.content || {
        syncedIds: [],
        hashes: {},
        rejectedHashes: {},
        seenBaseUrls: [],
        rejectedUrls: [],
      };
      if (!Array.isArray(mediaContent.seenBaseUrls)) mediaContent.seenBaseUrls = [];
      if (!Array.isArray(mediaContent.rejectedUrls)) mediaContent.rejectedUrls = [];

      for (const rawUrl of urlList) {
        const base = String(rawUrl || "").split("=")[0];
        if (base && !mediaContent.seenBaseUrls.includes(base)) {
          mediaContent.seenBaseUrls.push(base);
        }
        if (base && !mediaContent.rejectedUrls.includes(base)) {
          mediaContent.rejectedUrls.push(base);
        }
      }

      await updateGitHubFile(
        "src/data/syncedMedia.json",
        mediaContent,
        "Record rejected photo URL in cloud memory",
        mediaFile ? mediaFile.sha : null
      );

      if (Array.isArray(stagedProjects)) {
        const stagedData = await getGitHubFile("src/data/stagedProjects.json");
        await updateGitHubFile(
          "src/data/stagedProjects.json",
          stagedProjects,
          "Update staged projects after photo rejection",
          stagedData ? stagedData.sha : null
        );
      }

      return jsonResponse(200, { success: true, seenBaseUrls: mediaContent.seenBaseUrls }, origin);
    } catch (err) {
      return jsonResponse(500, { error: "Failed to record rejected photo: " + err.message }, origin);
    }
  }

  // 4. Scan Album
  if (action === "scan-album") {
    const albumPhotos = await scrapeAlbumPhotos(body.albumUrl || DEFAULT_ALBUM_URL);
    return jsonResponse(
      200,
      {
        totalFound: albumPhotos.length,
        photos: albumPhotos,
      },
      origin
    );
  }

  // 5. Save Staged Projects Queue in Cloud
  if (action === "save-staged") {
    const { stagedProjects } = body;
    if (!Array.isArray(stagedProjects)) {
      return jsonResponse(400, { error: "Missing or invalid 'stagedProjects' array." }, origin);
    }
    try {
      const stagedData = await getGitHubFile("src/data/stagedProjects.json");
      await updateGitHubFile(
        "src/data/stagedProjects.json",
        stagedProjects,
        "Update staged projects queue from online admin",
        stagedData ? stagedData.sha : null
      );
      return jsonResponse(200, { success: true }, origin);
    } catch (err) {
      return jsonResponse(500, { error: "Failed to save staged projects: " + err.message }, origin);
    }
  }

  // 6. Publish Approved Projects Directly to GitHub
  if (action === "publish-live") {
    const { projects, stagedProjects } = body;
    if (!projects || !Array.isArray(projects)) {
      return jsonResponse(400, { error: "Missing or invalid 'projects' array." }, origin);
    }

    try {
      let fileData = await getGitHubFile("src/data/projects.json");
      const sha = fileData ? fileData.sha : null;

      const commitMsg = `Publish handyman updates from online admin (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
      await updateGitHubFile("src/data/projects.json", projects, commitMsg, sha);

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

      return jsonResponse(
        200,
        {
          success: true,
          message:
            "Successfully published to GitHub! Netlify is now building and deploying your site live in ~30 seconds.",
        },
        origin
      );
    } catch (err) {
      console.error("Publish error:", err.message);
      return jsonResponse(
        500,
        {
          error: "Failed to publish live via GitHub API: " + err.message,
        },
        origin
      );
    }
  }

  return jsonResponse(400, { error: `Unknown action: ${action}` }, origin);
}
