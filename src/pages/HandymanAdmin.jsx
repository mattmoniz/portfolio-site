import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import initialLiveProjects from "../data/projects.json";
import initialStagedProjects from "../data/stagedProjects.json";
import syncedMedia from "../data/syncedMedia.json";
import { resolveHandymanImage } from "../data/handymanProjects";

const CATEGORY_PRESETS = [
  "Custom Carpentry & Woodwork",
  "Home Repairs & Improvements",
  "Bathroom Remodel",
  "Staircase",
  "Outdoor & Garden",
  "Play Area & Custom Builds",
];

const HandymanAdmin = () => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => typeof window !== "undefined" && Boolean(sessionStorage.getItem("handyman_admin_token"))
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("handyman_admin_user") || "null");
    } catch {
      return null;
    }
  });
  const [authError, setAuthError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "963213000468-906lvvb8v8e6vo9nf7d6org2esmvaq0v.apps.googleusercontent.com";

  // Data state
  const [liveProjects, setLiveProjects] = useState(initialLiveProjects || []);
  const [stagedProjects, setStagedProjects] = useState(initialStagedProjects || []);
  const [seenBaseUrls, setSeenBaseUrls] = useState(() => syncedMedia?.seenBaseUrls || []);

  // UI state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [editingLiveId, setEditingLiveId] = useState(null);

  // Check stored session and sync latest cloud projects & staged queue
  useEffect(() => {
    const savedToken = sessionStorage.getItem("handyman_admin_token");
    if (savedToken) {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";

    fetch("/.netlify/functions/handyman-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load-cloud-data", token }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.projects && Array.isArray(data.projects)) {
          setLiveProjects(data.projects);
        }
        if (data?.stagedProjects && Array.isArray(data.stagedProjects)) {
          setStagedProjects(data.stagedProjects);
        }
        if (data?.seenBaseUrls && Array.isArray(data.seenBaseUrls)) {
          setSeenBaseUrls(data.seenBaseUrls);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Google SSO Response Handler
  const handleGoogleResponse = async (response) => {
    if (!response || !response.credential) return;
    setIsVerifying(true);
    setAuthError("");

    try {
      const res = await fetch("/.netlify/functions/handyman-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-google", credential: response.credential }),
      });

      const data = await res.json();
      if (res.ok && data.authenticated) {
        sessionStorage.setItem("handyman_admin_token", data.token);
        if (data.user) {
          sessionStorage.setItem("handyman_admin_user", JSON.stringify(data.user));
          setUser(data.user);
        }
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || "Google authentication failed.");
      }
    } catch (err) {
      setAuthError("Failed to reach authentication server: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // Initialize Google Identity Services
  useEffect(() => {
    if (isAuthenticated) return;

    let timer;
    const tryInitGoogle = () => {
      if (window.google?.accounts?.id && googleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
          auto_select: false,
        });

        const btnDiv = document.getElementById("google-signin-btn");
        if (btnDiv) {
          btnDiv.innerHTML = "";
          window.google.accounts.id.renderButton(btnDiv, {
            theme: "filled_black",
            size: "large",
            shape: "pill",
            text: "signin_with",
            width: 320,
          });
        }
      } else {
        timer = setTimeout(tryInitGoogle, 300);
      }
    };

    tryInitGoogle();
    return () => clearTimeout(timer);
  }, [isAuthenticated, googleClientId]);

  const handleLogout = () => {
    sessionStorage.removeItem("handyman_admin_token");
    sessionStorage.removeItem("handyman_admin_user");
    setIsAuthenticated(false);
    setUser(null);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  const persistStagedInCloud = (updatedStaged) => {
    const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";
    fetch("/.netlify/functions/handyman-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-staged", token, stagedProjects: updatedStaged }),
    }).catch(() => {});
  };

  // Scan Google Photos Album on demand
  const handleScanAlbum = async () => {
    setIsScanning(true);
    setScanMessage("Checking Google Photos shared album for new uploads...");

    try {
      const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";
      const res = await fetch("/.netlify/functions/handyman-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan-album", token }),
      });

      const data = await res.json();
      if (res.ok && data.photos) {
        // Collect all photos already in live projects or previously synced/rejected
        const existingLiveUrls = new Set(seenBaseUrls);
        liveProjects.forEach((p) => {
          if (p.coverImage) existingLiveUrls.add(p.coverImage.split("=")[0]);
          (p.images || []).forEach((img) => existingLiveUrls.add((img.file || "").split("=")[0]));
        });

        // Collect photos already in staged projects
        const existingStagedUrls = new Set();
        stagedProjects.forEach((p) => {
          if (p.coverImage) existingStagedUrls.add(p.coverImage.split("=")[0]);
          (p.images || []).forEach((img) => existingStagedUrls.add((img.file || "").split("=")[0]));
        });

        // Filter out photos that already exist or were previously rejected
        const unassignedUrls = data.photos.filter((url) => {
          const base = url.split("=")[0];
          return !existingLiveUrls.has(base) && !existingStagedUrls.has(base);
        });

        if (unassignedUrls.length === 0) {
          setScanMessage(`✨ Checked ${data.totalFound} album photos. Everything is already up to date!`);
        } else {
          const newDraft = {
            id: `staged-${Date.now()}`,
            title: "New Handyman Project",
            category: "Home Repairs & Improvements",
            featured: true,
            summary: "Recently completed project photos ready for client showcase.",
            description: "Detailed description of materials used, custom fabrication, and work performed.",
            tags: ["New Work", "Handyman"],
            coverImage: unassignedUrls[0],
            images: unassignedUrls.map((url, idx) => ({
              file: url,
              caption: `Photo ${idx + 1}`,
            })),
          };

          const updatedStaged = [newDraft, ...stagedProjects];
          setStagedProjects(updatedStaged);
          setScanMessage(`🎉 Found ${unassignedUrls.length} new photo(s)! Staged into a new draft below.`);
          persistStagedInCloud(updatedStaged);
        }
      } else {
        setScanMessage(data.error || "Unable to scan Google Photos album right now.");
      }
    } catch (err) {
      setScanMessage("Album scan request error: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Update a field on a staged project
  const handleUpdateStagedField = (projectId, field, value) => {
    setStagedProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, [field]: value } : p))
    );
  };

  // Update a photo caption on a staged project
  const handleUpdateStagedCaption = (projectId, photoIndex, caption) => {
    setStagedProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const newImages = [...(p.images || [])];
        newImages[photoIndex] = { ...newImages[photoIndex], caption };
        return { ...p, images: newImages };
      })
    );
  };

  // Reorder photo left/right inside a staged project
  const handleMoveStagedPhotoOrder = (projectId, photoIndex, direction) => {
    setStagedProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const imgs = [...(p.images || [])];
        const targetIdx = photoIndex + direction;
        if (targetIdx < 0 || targetIdx >= imgs.length) return p;
        [imgs[photoIndex], imgs[targetIdx]] = [imgs[targetIdx], imgs[photoIndex]];
        return { ...p, images: imgs };
      })
    );
  };

  // Set cover photo on a staged project
  const handleSetStagedCover = (projectId, fileUrl) => {
    setStagedProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, coverImage: fileUrl } : p))
    );
  };

  // Permanently reject & remove an unwanted photo from a staged project
  const handleRemoveStagedPhoto = (projectId, photoIndex) => {
    const targetProject = stagedProjects.find((p) => p.id === projectId);
    const removedUrl = targetProject?.images?.[photoIndex]?.file;

    const updatedStaged = stagedProjects
      .map((p) => {
        if (p.id !== projectId) return p;
        const newImages = (p.images || []).filter((_, idx) => idx !== photoIndex);
        const newCover =
          p.coverImage === p.images[photoIndex]?.file
            ? newImages[0]?.file || ""
            : p.coverImage;
        return { ...p, images: newImages, coverImage: newCover };
      })
      .filter((p) => (p.images || []).length > 0);

    setStagedProjects(updatedStaged);

    if (removedUrl) {
      const base = removedUrl.split("=")[0];
      setSeenBaseUrls((prev) => (prev.includes(base) ? prev : [...prev, base]));
      const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";
      fetch("/.netlify/functions/handyman-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject-photo",
          token,
          urls: [removedUrl],
          stagedProjects: updatedStaged,
        }),
      }).catch(() => {});
      setPublishMessage("🚫 Photo removed and saved to permanent cloud rejection memory.");
    }
  };

  // Move or split a staged photo into a new draft, another staged draft, or an existing live project
  const handleTransferStagedPhoto = (sourceProjectId, photoIndex, destinationValue) => {
    if (!destinationValue) return;
    const sourceProject = stagedProjects.find((p) => p.id === sourceProjectId);
    const photoObj = sourceProject?.images?.[photoIndex];
    if (!photoObj) return;

    // Remove photo from source staged project
    let nextStaged = stagedProjects
      .map((p) => {
        if (p.id !== sourceProjectId) return p;
        const remaining = (p.images || []).filter((_, i) => i !== photoIndex);
        const nextCover =
          p.coverImage === photoObj.file ? remaining[0]?.file || "" : p.coverImage;
        return { ...p, images: remaining, coverImage: nextCover };
      })
      .filter((p) => (p.images || []).length > 0);

    if (destinationValue === "__new_draft__") {
      const newDraft = {
        id: `staged-${Date.now()}`,
        title: "New Split Project",
        category: sourceProject.category || "Home Repairs & Improvements",
        featured: true,
        summary: "Recently completed project photos ready for client showcase.",
        description: "Detailed description of materials used, custom fabrication, and work performed.",
        tags: [...(sourceProject.tags || ["New Work"])],
        coverImage: photoObj.file,
        images: [{ ...photoObj }],
      };
      nextStaged = [newDraft, ...nextStaged];
      setStagedProjects(nextStaged);
      persistStagedInCloud(nextStaged);
      setPublishMessage("✨ Split photo into a new separate staged project draft!");
    } else if (destinationValue.startsWith("staged:")) {
      const targetStagedId = destinationValue.slice("staged:".length);
      nextStaged = nextStaged.map((p) =>
        p.id === targetStagedId
          ? {
              ...p,
              images: [...(p.images || []), { ...photoObj }],
              coverImage: p.coverImage || photoObj.file,
            }
          : p
      );
      setStagedProjects(nextStaged);
      persistStagedInCloud(nextStaged);
      setPublishMessage("📥 Moved photo into selected staged draft.");
    } else if (destinationValue.startsWith("live:")) {
      const targetLiveId = destinationValue.slice("live:".length);
      const targetLive = liveProjects.find((p) => p.id === targetLiveId);
      const nextLive = liveProjects.map((p) =>
        p.id === targetLiveId
          ? {
              ...p,
              images: [{ ...photoObj }, ...(p.images || [])],
              coverImage: p.coverImage || photoObj.file,
            }
          : p
      );
      setLiveProjects(nextLive);
      setStagedProjects(nextStaged);
      setEditingLiveId(targetLiveId);
      setPublishMessage(
        `🌟 Added photo to live project "${targetLive?.title}". Click "Save & Push Live" on that card to publish!`
      );
    }
  };

  // Discard an entire staged draft (and remember its photos as rejected so they don't return)
  const handleDiscardStaged = (projectId) => {
    if (!window.confirm("Discard this staged draft and permanently ignore its photos on future album scans?")) {
      return;
    }
    const discarded = stagedProjects.find((p) => p.id === projectId);
    const urls = (discarded?.images || []).map((img) => img.file).filter(Boolean);
    const updatedStaged = stagedProjects.filter((p) => p.id !== projectId);
    setStagedProjects(updatedStaged);

    if (urls.length > 0) {
      const bases = urls.map((u) => u.split("=")[0]);
      setSeenBaseUrls((prev) => Array.from(new Set([...prev, ...bases])));
      const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";
      fetch("/.netlify/functions/handyman-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject-photo",
          token,
          urls,
          stagedProjects: updatedStaged,
        }),
      }).catch(() => {});
    }
  };

  // Approve & Publish Live
  const handleApproveAndPublish = async (stagedProject) => {
    setIsPublishing(true);
    setPublishMessage("Approving & deploying live to Netlify...");

    try {
      const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";

      const cleanApproved = {
        ...stagedProject,
        id: stagedProject.id.startsWith("staged-")
          ? stagedProject.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || stagedProject.id
          : stagedProject.id,
      };

      const updatedLive = [cleanApproved, ...liveProjects];
      const remainingStaged = stagedProjects.filter((p) => p.id !== stagedProject.id);

      const res = await fetch("/.netlify/functions/handyman-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish-live",
          token,
          projects: updatedLive,
          stagedProjects: remainingStaged,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLiveProjects(updatedLive);
        setStagedProjects(remainingStaged);
        setPublishMessage("🚀 " + data.message);
      } else {
        setPublishMessage("⚠️ " + (data.error || "Failed to deploy live."));
      }
    } catch (err) {
      setPublishMessage("Deploy request error: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Reorder live project cards (up/down)
  const handleMoveLiveProjectOrder = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= liveProjects.length) return;
    const nextLive = [...liveProjects];
    [nextLive[index], nextLive[targetIdx]] = [nextLive[targetIdx], nextLive[index]];
    setLiveProjects(nextLive);

    const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";
    try {
      await fetch("/.netlify/functions/handyman-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish-live",
          token,
          projects: nextLive,
          stagedProjects,
        }),
      });
      setPublishMessage("✅ Updated project card display order on live site!");
    } catch {}
  };

  // Reorder photo inside a live project
  const handleMoveLivePhotoOrder = (projectId, photoIndex, direction) => {
    setLiveProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const imgs = [...(p.images || [])];
        const targetIdx = photoIndex + direction;
        if (targetIdx < 0 || targetIdx >= imgs.length) return p;
        [imgs[photoIndex], imgs[targetIdx]] = [imgs[targetIdx], imgs[photoIndex]];
        return { ...p, images: imgs };
      })
    );
  };

  // Update photo caption inside a live project
  const handleUpdateLivePhotoCaption = (projectId, photoIndex, caption) => {
    setLiveProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const imgs = [...(p.images || [])];
        imgs[photoIndex] = { ...imgs[photoIndex], caption };
        return { ...p, images: imgs };
      })
    );
  };

  // Remove photo from a live project
  const handleRemoveLivePhoto = (projectId, photoIndex) => {
    setLiveProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const imgs = (p.images || []).filter((_, i) => i !== photoIndex);
        const nextCover =
          p.coverImage === p.images?.[photoIndex]?.file
            ? imgs[0]?.file || ""
            : p.coverImage;
        return { ...p, images: imgs, coverImage: nextCover };
      })
    );
  };

  // Save changes made to an already live project
  const handleSaveLiveEdit = async () => {
    setIsPublishing(true);
    setPublishMessage("Updating live project & photos in the cloud...");

    try {
      const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";
      const res = await fetch("/.netlify/functions/handyman-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish-live",
          token,
          projects: liveProjects,
          stagedProjects,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEditingLiveId(null);
        setPublishMessage("✅ Live project & photo changes saved and deployed!");
      } else {
        setPublishMessage("⚠️ " + (data.error || "Failed to update project."));
      }
    } catch (err) {
      setPublishMessage("Save error: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // ==========================================
  // 1. Google SSO Protection Screen
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#151030] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#915eff]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center mb-6 relative z-10">
            <div className="w-16 h-16 bg-[#915eff]/20 text-[#915eff] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-[#915eff]/30 shadow-inner">
              🔒
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Handyman Admin Portal</h1>
            <p className="text-[#aaa6c3] text-sm mt-2">
              Sign in with Google to review staged cloud photos, organize project cards, and publish live.
            </p>
          </div>

          <div className="space-y-4 relative z-10">
            <div className="flex flex-col items-center justify-center space-y-3 py-2">
              <div id="google-signin-btn" className="min-h-[44px] flex items-center justify-center" />
              {isVerifying && (
                <p className="text-xs text-[#dfd9ff] flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Verifying Google Identity...
                </p>
              )}
              <p className="text-[11px] text-[#aaa6c3] text-center">
                Protected by Google Identity SSO. Restricted strictly to{" "}
                <span className="text-white font-mono">monizri@gmail.com</span>.
              </p>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg p-3 text-center">
                {authError}
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-xs text-[#aaa6c3]">
            <Link to="/handyman" className="hover:text-white transition-colors underline">
              ← Return to public handyman page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. Unlocked Admin Dashboard
  // ==========================================
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#050816]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛠️</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">Handyman Staging &amp; Admin</h1>
                {user ? (
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5">
                    {user.picture ? (
                      <img src={user.picture} alt="" className="w-3.5 h-3.5 rounded-full" />
                    ) : (
                      <span>👤</span>
                    )}
                    {user.email}
                  </span>
                ) : (
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    ● Authenticated
                  </span>
                )}
              </div>
              <p className="text-xs text-[#aaa6c3]">
                {stagedProjects.length > 0
                  ? `⏳ ${stagedProjects.length} staged project(s) ready for review`
                  : "✨ All project photos published and live"}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handleScanAlbum}
              disabled={isScanning}
              className="bg-[#915eff] hover:bg-[#7e47f2] disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              title="Scrape Google Photos album for newly added photos"
            >
              <span className={isScanning ? "animate-spin" : ""}>🔄</span>
              {isScanning ? "Checking Photos..." : "Check Google Photos Now"}
            </button>

            <Link
              to="/handyman"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-3.5 py-2 rounded-lg border border-white/10 transition-all flex items-center gap-1.5"
            >
              <span>👁️</span> Public Site
            </Link>

            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium px-3 py-2 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              title="Lock admin dashboard"
            >
              <span>🔒</span> Lock
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-10">
        {/* Alerts / Banner Messages */}
        {(scanMessage || publishMessage) && (
          <div className="space-y-2">
            {scanMessage && (
              <div className="bg-[#915eff]/10 border border-[#915eff]/30 text-[#dfd9ff] text-sm rounded-xl p-4 flex items-center justify-between">
                <span>{scanMessage}</span>
                <button
                  onClick={() => setScanMessage("")}
                  className="text-white/60 hover:text-white text-xs ml-4 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
            {publishMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl p-4 flex items-center justify-between">
                <span>{publishMessage}</span>
                <button
                  onClick={() => setPublishMessage("")}
                  className="text-white/60 hover:text-white text-xs ml-4 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* SECTION 1: PENDING STAGED PROJECTS AWAITING APPROVAL    */}
        {/* ======================================================== */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>⏳</span> Pending Review &amp; Staging
              </h2>
              <p className="text-xs text-[#aaa6c3] mt-0.5">
                New photos uploaded to your Google Photos album land here first. Reorder photos, split them into separate cards, or move a photo into an existing live project.
              </p>
            </div>
            <span className="bg-[#915eff]/20 text-[#dfd9ff] border border-[#915eff]/40 text-xs font-semibold px-2.5 py-1 rounded-full">
              {stagedProjects.length} Draft(s)
            </span>
          </div>

          {stagedProjects.length === 0 ? (
            <div className="bg-[#151030]/60 border border-dashed border-white/15 rounded-2xl p-8 text-center">
              <span className="text-4xl block mb-2">📸</span>
              <h3 className="text-base font-semibold text-white">No photos pending approval</h3>
              <p className="text-sm text-[#aaa6c3] max-w-md mx-auto mt-1 mb-4">
                When you take new photos, upload them to your Google Photos shared album, then click the button below to stage them in the cloud.
              </p>
              <button
                onClick={handleScanAlbum}
                disabled={isScanning}
                className="bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-4 py-2 rounded-lg border border-white/20 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>🔄</span> Check Google Photos Album Now
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {stagedProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-[#151030] border-2 border-[#915eff]/50 rounded-2xl p-6 shadow-xl space-y-6 relative overflow-hidden"
                >
                  {/* Staged Header Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#915eff] text-white text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                        Awaiting Approval
                      </span>
                      <span className="text-xs text-[#aaa6c3]">
                        📷 {project.images?.length || 0} photo(s)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDiscardStaged(project.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-all cursor-pointer"
                      >
                        🗑️ Reject &amp; Discard Draft
                      </button>
                      <button
                        onClick={() => handleApproveAndPublish(project)}
                        disabled={isPublishing}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>🚀</span>
                        {isPublishing ? "Publishing Live..." : "Approve & Deploy Live"}
                      </button>
                    </div>
                  </div>

                  {/* Form Inputs Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#dfd9ff] uppercase tracking-wider mb-1">
                        Project Title
                      </label>
                      <input
                        type="text"
                        value={project.title}
                        onChange={(e) => handleUpdateStagedField(project.id, "title", e.target.value)}
                        className="w-full bg-[#050816] border border-white/15 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#915eff]"
                        placeholder="e.g. Double French Doors Installation"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#dfd9ff] uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={CATEGORY_PRESETS.includes(project.category) ? project.category : "custom"}
                          onChange={(e) => {
                            if (e.target.value !== "custom") {
                              handleUpdateStagedField(project.id, "category", e.target.value);
                            }
                          }}
                          className="bg-[#050816] border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#915eff]"
                        >
                          {CATEGORY_PRESETS.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="custom">Custom...</option>
                        </select>
                        <input
                          type="text"
                          value={project.category}
                          onChange={(e) => handleUpdateStagedField(project.id, "category", e.target.value)}
                          className="flex-1 bg-[#050816] border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#915eff]"
                          placeholder="Category name"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-[#dfd9ff] uppercase tracking-wider mb-1">
                        Short Summary (Card Preview)
                      </label>
                      <input
                        type="text"
                        value={project.summary}
                        onChange={(e) => handleUpdateStagedField(project.id, "summary", e.target.value)}
                        className="w-full bg-[#050816] border border-white/15 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#915eff]"
                        placeholder="Concise 1-sentence summary of the work done"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-[#dfd9ff] uppercase tracking-wider mb-1">
                        Detailed Narrative (Modal View)
                      </label>
                      <textarea
                        rows={3}
                        value={project.description}
                        onChange={(e) => handleUpdateStagedField(project.id, "description", e.target.value)}
                        className="w-full bg-[#050816] border border-white/15 rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#915eff]"
                        placeholder="Explain framing adjustments, finishes, challenges, hardware, etc."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-[#dfd9ff] uppercase tracking-wider mb-1">
                        Tags (comma separated)
                      </label>
                      <input
                        type="text"
                        value={(project.tags || []).join(", ")}
                        onChange={(e) =>
                          handleUpdateStagedField(
                            project.id,
                            "tags",
                            e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                          )
                        }
                        className="w-full bg-[#050816] border border-white/15 rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#915eff]"
                        placeholder="Double Doors, Wainscoting, Finish Carpentry"
                      />
                    </div>
                  </div>

                  {/* Photos Grid with Cover Selection, Reordering, Captions & Project Split/Transfer */}
                  <div>
                    <h4 className="text-xs font-semibold text-[#dfd9ff] uppercase tracking-wider mb-3">
                      Review, Reorder &amp; Assign Photos (Use ← / → to reorder, ★ for cover, or move a photo to another card)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {(project.images || []).map((img, idx) => {
                        const isCover = project.coverImage === img.file;
                        const totalImgs = (project.images || []).length;
                        return (
                          <div
                            key={idx}
                            className={`bg-[#050816] rounded-xl overflow-hidden border ${
                              isCover ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-white/10"
                            } flex flex-col justify-between`}
                          >
                            <div className="relative aspect-video bg-black/50">
                              <img
                                src={resolveHandymanImage(img.file)}
                                alt={`Draft photo ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-2 left-2 bg-black/75 text-white/90 text-[10px] font-semibold px-2 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              {isCover && (
                                <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                                  ★ Cover
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveStagedPhoto(project.id, idx)}
                                className="absolute top-2 right-2 bg-black/70 hover:bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                                title="Permanently reject & remove this photo"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="p-3 space-y-2">
                              <input
                                type="text"
                                value={img.caption || ""}
                                onChange={(e) => handleUpdateStagedCaption(project.id, idx, e.target.value)}
                                placeholder="Photo caption..."
                                className="w-full bg-[#151030] border border-white/10 rounded px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#915eff]"
                              />

                              {/* Reorder + Make Cover Row */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveStagedPhotoOrder(project.id, idx, -1)}
                                  className="bg-white/5 hover:bg-white/15 disabled:opacity-30 text-white text-[11px] px-2 py-1 rounded transition-colors cursor-pointer"
                                  title="Move photo earlier"
                                >
                                  ←
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === totalImgs - 1}
                                  onClick={() => handleMoveStagedPhotoOrder(project.id, idx, 1)}
                                  className="bg-white/5 hover:bg-white/15 disabled:opacity-30 text-white text-[11px] px-2 py-1 rounded transition-colors cursor-pointer"
                                  title="Move photo later"
                                >
                                  →
                                </button>
                                {!isCover && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetStagedCover(project.id, img.file)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-[11px] font-medium py-1 rounded transition-colors text-center cursor-pointer"
                                  >
                                    ★ Cover
                                  </button>
                                )}
                              </div>

                              {/* Move / Split Photo Dropdown */}
                              <select
                                value=""
                                onChange={(e) =>
                                  handleTransferStagedPhoto(project.id, idx, e.target.value)
                                }
                                className="w-full bg-[#151030] border border-white/10 rounded px-2 py-1 text-[11px] text-[#dfd9ff] focus:outline-none focus:border-[#915eff]"
                              >
                                <option value="">⇄ Move / Split photo to...</option>
                                {totalImgs > 1 && (
                                  <option value="__new_draft__">
                                    ➕ Split into a New Staged Project Card
                                  </option>
                                )}
                                {stagedProjects
                                  .filter((other) => other.id !== project.id)
                                  .map((other) => (
                                    <option key={other.id} value={`staged:${other.id}`}>
                                      📥 Draft: {other.title}
                                    </option>
                                  ))}
                                <optgroup label="Add to Existing Live Project">
                                  {liveProjects.map((lp) => (
                                    <option key={lp.id} value={`live:${lp.id}`}>
                                      🌟 Live: {lp.title}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* SECTION 2: LIVE PROJECTS (Directly Editable from Phone) */}
        {/* ======================================================== */}
        <section className="pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🌟</span> Active Live Projects ({liveProjects.length})
              </h2>
              <p className="text-xs text-[#aaa6c3] mt-0.5">
                Click &ldquo;Edit Project &amp; Photos&rdquo; on any card to update wording, reorder photos, or adjust card sequence on mattmoniz.io/handyman.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveProjects.map((project, projectIdx) => {
              const isEditing = editingLiveId === project.id;

              return (
                <div
                  key={project.id}
                  className={`bg-[#151030] border ${
                    isEditing ? "border-[#915eff] md:col-span-2 lg:col-span-3" : "border-white/10"
                  } rounded-2xl overflow-hidden flex flex-col justify-between transition-all`}
                >
                  {/* Image Header */}
                  <div className="relative h-44 bg-black/40">
                    <img
                      src={resolveHandymanImage(project.coverImage)}
                      alt={project.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[#dfd9ff] border border-white/15 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                      {project.category}
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={projectIdx === 0}
                        onClick={() => handleMoveLiveProjectOrder(projectIdx, -1)}
                        className="bg-black/60 hover:bg-black/90 disabled:opacity-30 text-white text-[11px] w-6 h-6 rounded-full flex items-center justify-center border border-white/15 cursor-pointer"
                        title="Move card earlier in gallery"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={projectIdx === liveProjects.length - 1}
                        onClick={() => handleMoveLiveProjectOrder(projectIdx, 1)}
                        className="bg-black/60 hover:bg-black/90 disabled:opacity-30 text-white text-[11px] w-6 h-6 rounded-full flex items-center justify-center border border-white/15 cursor-pointer"
                        title="Move card later in gallery"
                      >
                        ↓
                      </button>
                      <span className="bg-black/60 backdrop-blur-md text-white text-[11px] px-2 py-0.5 rounded-full">
                        📷 {project.images?.length || 1}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-[#aaa6c3] uppercase font-bold">Title</label>
                            <input
                              type="text"
                              value={project.title}
                              onChange={(e) =>
                                setLiveProjects((prev) =>
                                  prev.map((p) => (p.id === project.id ? { ...p, title: e.target.value } : p))
                                )
                              }
                              className="w-full bg-[#050816] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#aaa6c3] uppercase font-bold">Category</label>
                            <input
                              type="text"
                              value={project.category}
                              onChange={(e) =>
                                setLiveProjects((prev) =>
                                  prev.map((p) => (p.id === project.id ? { ...p, category: e.target.value } : p))
                                )
                              }
                              className="w-full bg-[#050816] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] text-[#aaa6c3] uppercase font-bold">Summary</label>
                            <textarea
                              rows={2}
                              value={project.summary}
                              onChange={(e) =>
                                setLiveProjects((prev) =>
                                  prev.map((p) => (p.id === project.id ? { ...p, summary: e.target.value } : p))
                                )
                              }
                              className="w-full bg-[#050816] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] text-[#aaa6c3] uppercase font-bold">
                              Detailed Description
                            </label>
                            <textarea
                              rows={3}
                              value={project.description || ""}
                              onChange={(e) =>
                                setLiveProjects((prev) =>
                                  prev.map((p) =>
                                    p.id === project.id ? { ...p, description: e.target.value } : p
                                  )
                                )
                              }
                              className="w-full bg-[#050816] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] text-[#aaa6c3] uppercase font-bold">
                              Tags (comma separated)
                            </label>
                            <input
                              type="text"
                              value={(project.tags || []).join(", ")}
                              onChange={(e) =>
                                setLiveProjects((prev) =>
                                  prev.map((p) =>
                                    p.id === project.id
                                      ? {
                                          ...p,
                                          tags: e.target.value
                                            .split(",")
                                            .map((t) => t.trim())
                                            .filter(Boolean),
                                        }
                                      : p
                                  )
                                )
                              }
                              className="w-full bg-[#050816] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                        </div>

                        {/* Live Project Photo Reordering & Caption Manager */}
                        <div className="space-y-2 pt-2 border-t border-white/10">
                          <label className="text-[10px] text-[#dfd9ff] uppercase font-bold block">
                            Project Photos (Use ← / → to reorder, ★ for cover)
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {(project.images || []).map((img, imgIdx) => {
                              const isCover = project.coverImage === img.file;
                              const totalImgs = (project.images || []).length;
                              return (
                                <div
                                  key={imgIdx}
                                  className={`bg-[#050816] rounded-lg overflow-hidden border ${
                                    isCover ? "border-emerald-500" : "border-white/10"
                                  } p-2 space-y-2`}
                                >
                                  <div className="relative aspect-video rounded overflow-hidden bg-black/50">
                                    <img
                                      src={resolveHandymanImage(img.file)}
                                      alt={img.caption || ""}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute bottom-1 left-1 bg-black/75 text-white text-[10px] px-1.5 py-0.2 rounded">
                                      #{imgIdx + 1}
                                    </span>
                                    {isCover && (
                                      <span className="absolute top-1 left-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                        ★ Cover
                                      </span>
                                    )}
                                    {totalImgs > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLivePhoto(project.id, imgIdx)}
                                        className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
                                        title="Remove photo from project"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    value={img.caption || ""}
                                    onChange={(e) =>
                                      handleUpdateLivePhotoCaption(project.id, imgIdx, e.target.value)
                                    }
                                    placeholder="Caption..."
                                    className="w-full bg-[#151030] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
                                  />
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={imgIdx === 0}
                                      onClick={() => handleMoveLivePhotoOrder(project.id, imgIdx, -1)}
                                      className="bg-white/5 hover:bg-white/15 disabled:opacity-30 text-white text-[11px] px-2 py-0.5 rounded cursor-pointer"
                                    >
                                      ←
                                    </button>
                                    <button
                                      type="button"
                                      disabled={imgIdx === totalImgs - 1}
                                      onClick={() => handleMoveLivePhotoOrder(project.id, imgIdx, 1)}
                                      className="bg-white/5 hover:bg-white/15 disabled:opacity-30 text-white text-[11px] px-2 py-0.5 rounded cursor-pointer"
                                    >
                                      →
                                    </button>
                                    {!isCover && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setLiveProjects((prev) =>
                                            prev.map((p) =>
                                              p.id === project.id ? { ...p, coverImage: img.file } : p
                                            )
                                          )
                                        }
                                        className="flex-1 bg-white/5 hover:bg-white/15 text-white text-[10px] py-0.5 rounded cursor-pointer"
                                      >
                                        ★ Cover
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSaveLiveEdit}
                            disabled={isPublishing}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-2 rounded-lg transition-all cursor-pointer"
                          >
                            💾 Save &amp; Push Live
                          </button>
                          <button
                            onClick={() => setEditingLiveId(null)}
                            className="bg-white/10 hover:bg-white/15 text-white text-xs px-4 py-2 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <h3 className="font-bold text-white text-base leading-snug">{project.title}</h3>
                          <p className="text-xs text-[#aaa6c3] line-clamp-3">{project.summary}</p>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[11px] text-emerald-400 font-medium">● Live on site</span>
                          <button
                            onClick={() => setEditingLiveId(project.id)}
                            className="bg-[#915eff]/20 hover:bg-[#915eff]/30 text-[#dfd9ff] border border-[#915eff]/40 text-xs font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>✏️</span> Edit Project &amp; Photos
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};

export default HandymanAdmin;
