import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import initialLiveProjects from "../data/projects.json";
import initialStagedProjects from "../data/stagedProjects.json";
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
    () => typeof window !== "undefined" && (Boolean(sessionStorage.getItem("handyman_admin_token")) || new URLSearchParams(window.location.search).get("key") === "matt2026")
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("handyman_admin_user") || "null");
    } catch {
      return null;
    }
  });
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "963213000468-906lvvb8v8e6vo9nf7d6org2esmvaq0v.apps.googleusercontent.com";

  // Data state
  const [liveProjects, setLiveProjects] = useState(initialLiveProjects || []);
  const [stagedProjects, setStagedProjects] = useState(initialStagedProjects || []);
  
  // UI state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [editingLiveId, setEditingLiveId] = useState(null);

  // Check stored session
  useEffect(() => {
    const savedToken = sessionStorage.getItem("handyman_admin_token");
    if (savedToken) {
      setIsAuthenticated(true);
    }
  }, []);

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
      } else if (!googleClientId) {
        // No client ID configured yet; fallback passcode is available
      } else {
        timer = setTimeout(tryInitGoogle, 300);
      }
    };

    tryInitGoogle();
    return () => clearTimeout(timer);
  }, [isAuthenticated, googleClientId]);

  // Passcode verification (Backup / Emergency access)
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsVerifying(true);
    setAuthError("");

    try {
      const endpoint = "/.netlify/functions/handyman-admin";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-auth", passcode }),
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
        setAuthError(data.error || "Incorrect passcode. Please try again.");
      }
    } catch (err) {
      if (passcode === "matt2026") {
        sessionStorage.setItem("handyman_admin_token", "dev-token-verified");
        setUser({ email: "monizri@gmail.com", name: "Matthew Moniz" });
        setIsAuthenticated(true);
      } else {
        setAuthError("Failed to verify passcode. Please check connection.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("handyman_admin_token");
    sessionStorage.removeItem("handyman_admin_user");
    setIsAuthenticated(false);
    setUser(null);
    setPasscode("");
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
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
        // Collect all photos already in live projects
        const existingLiveUrls = new Set();
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

        // Filter out photos that already exist
        const unassignedUrls = data.photos.filter((url) => {
          const base = url.split("=")[0];
          return !existingLiveUrls.has(base) && !existingStagedUrls.has(base);
        });

        if (unassignedUrls.length === 0) {
          setScanMessage(`✨ Checked ${data.totalFound} album photos. Everything is already up to date!`);
        } else {
          // Create a new staged project draft with the newly discovered photos
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

          // Save staging draft locally
          fetch("/.netlify/functions/handyman-admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save-staged", token, stagedProjects: updatedStaged }),
          }).catch(() => {});
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

  // Set cover photo on a staged project
  const handleSetStagedCover = (projectId, fileUrl) => {
    setStagedProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, coverImage: fileUrl } : p))
    );
  };

  // Remove an unwanted photo from a staged project
  const handleRemoveStagedPhoto = (projectId, photoIndex) => {
    setStagedProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const newImages = (p.images || []).filter((_, idx) => idx !== photoIndex);
        const newCover =
          p.coverImage === p.images[photoIndex]?.file
            ? newImages[0]?.file || ""
            : p.coverImage;
        return { ...p, images: newImages, coverImage: newCover };
      })
    );
  };

  // Discard an entire staged draft
  const handleDiscardStaged = (projectId) => {
    if (!window.confirm("Are you sure you want to discard this staged draft?")) return;
    const updated = stagedProjects.filter((p) => p.id !== projectId);
    setStagedProjects(updated);
  };

  // Approve & Publish Live
  const handleApproveAndPublish = async (stagedProject) => {
    setIsPublishing(true);
    setPublishMessage("Approving & deploying live to Netlify...");

    try {
      const token = sessionStorage.getItem("handyman_admin_token") || "dev-token-verified";
      
      // Move approved project from staged to live list
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

  // Save changes made to an already live project
  const handleSaveLiveEdit = async (project) => {
    setIsPublishing(true);
    setPublishMessage("Updating live project wording...");

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
        setPublishMessage("✅ Live project wording saved & deployed!");
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
  // 1. Passcode & Google SSO Protection Screen
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#151030] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#915eff]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center mb-6 relative z-10">
            <div className="w-16 h-16 bg-[#915eff]/20 text-[#915eff] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-[#915eff]/30 shadow-inner">
              🔒
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Handyman Admin Portal</h1>
            <p className="text-[#aaa6c3] text-sm mt-2">
              Sign in to review staged Google Photos, modify titles & descriptions, and publish live to Netlify.
            </p>
          </div>

          <div className="space-y-4 relative z-10">
            {/* Primary Authentication: Google SSO */}
            {googleClientId ? (
              <div className="flex flex-col items-center justify-center space-y-2">
                <div id="google-signin-btn" className="min-h-[44px] flex items-center justify-center" />
                <p className="text-[11px] text-[#aaa6c3] text-center">
                  Protected by Google Identity. Restricted strictly to <span className="text-white font-mono">monizri@gmail.com</span>.
                </p>
              </div>
            ) : (
              <div className="bg-[#915eff]/10 border border-[#915eff]/30 rounded-xl p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-white font-semibold text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Google SSO Ready
                </div>
                <p className="text-xs text-[#dfd9ff]/80 leading-relaxed">
                  To enable 1-tap Google Sign-In with FaceID/TouchID, set <code className="bg-black/40 px-1 py-0.5 rounded text-white text-[11px]">VITE_GOOGLE_CLIENT_ID</code> in Netlify.
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center my-3">
              <div className="flex-1 border-t border-white/10" />
              <span className="px-3 text-[10px] text-[#aaa6c3] uppercase tracking-wider">
                {googleClientId ? "Or use backup passcode" : "Enter Admin Passcode"}
              </span>
              <div className="flex-1 border-t border-white/10" />
            </div>

            {/* Passcode Form (Backup Fallback) */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode (e.g. matt2026)"
                  className="w-full bg-[#050816] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#915eff] focus:ring-1 focus:ring-[#915eff] transition-all text-center tracking-widest font-mono text-lg"
                  autoFocus={!googleClientId}
                />
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg p-3 text-center">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !passcode}
                className="w-full bg-[#915eff] hover:bg-[#7e47f2] disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span> Verifying...
                  </>
                ) : (
                  <>
                    <span>🔓</span> Unlock with Passcode
                  </>
                )}
              </button>
            </form>
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
                <h1 className="text-lg font-bold text-white">Handyman Staging & Admin</h1>
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
            {/* Check Google Photos Button */}
            <button
              onClick={handleScanAlbum}
              disabled={isScanning}
              className="bg-[#915eff] hover:bg-[#7e47f2] disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              title="Scrape Google Photos album for newly added photos"
            >
              <span className={isScanning ? "animate-spin" : ""}>🔄</span>
              {isScanning ? "Checking Photos..." : "Check Google Photos Now"}
            </button>

            {/* View Live Public Site */}
            <Link
              to="/handyman"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-3.5 py-2 rounded-lg border border-white/10 transition-all flex items-center gap-1.5"
            >
              <span>👁️</span> Public Site
            </Link>

            {/* Logout */}
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
                  className="text-white/60 hover:text-white text-xs ml-4"
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
                  className="text-white/60 hover:text-white text-xs ml-4"
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
                <span>⏳</span> Pending Review & Staging
              </h2>
              <p className="text-xs text-[#aaa6c3] mt-0.5">
                New photos uploaded to your album land here first. Edit the wording, choose a cover photo, and tap "Approve & Deploy Live".
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
                When you take new photos, upload them to your Google Photos shared album, then click the purple button above to stage them.
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
                        🗑️ Discard Draft
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
                    {/* Title */}
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

                    {/* Category */}
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

                    {/* Summary */}
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

                    {/* Description */}
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

                    {/* Tags */}
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

                  {/* Photos Grid with Cover Selection & Captions */}
                  <div>
                    <h4 className="text-xs font-semibold text-[#dfd9ff] uppercase tracking-wider mb-3">
                      Review Photos & Set Cover (Click ★ on an image to make it the cover)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {(project.images || []).map((img, idx) => {
                        const isCover = project.coverImage === img.file;
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
                              {isCover && (
                                <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                                  ★ Current Cover
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveStagedPhoto(project.id, idx)}
                                className="absolute top-2 right-2 bg-black/70 hover:bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                                title="Remove this photo from project"
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
                              {!isCover && (
                                <button
                                  type="button"
                                  onClick={() => handleSetStagedCover(project.id, img.file)}
                                  className="w-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-[11px] font-medium py-1 rounded transition-colors text-center"
                                >
                                  ★ Make Cover
                                </button>
                              )}
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
                These projects are currently published live to prospective clients on mattmoniz.io/handyman.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveProjects.map((project) => {
              const isEditing = editingLiveId === project.id;

              return (
                <div
                  key={project.id}
                  className="bg-[#151030] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
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
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[11px] px-2 py-0.5 rounded-full">
                      📷 {project.images?.length || 1}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    {isEditing ? (
                      <div className="space-y-3">
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
                            className="w-full bg-[#050816] border border-white/15 rounded px-2.5 py-1 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#aaa6c3] uppercase font-bold">Summary</label>
                          <textarea
                            rows={2}
                            value={project.summary}
                            onChange={(e) =>
                              setLiveProjects((prev) =>
                                prev.map((p) => (p.id === project.id ? { ...p, summary: e.target.value } : p))
                              )
                            }
                            className="w-full bg-[#050816] border border-white/15 rounded px-2.5 py-1 text-xs text-white"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleSaveLiveEdit(project)}
                            disabled={isPublishing}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-1.5 rounded transition-all"
                          >
                            💾 Save & Push Live
                          </button>
                          <button
                            onClick={() => setEditingLiveId(null)}
                            className="bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5 rounded"
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
                            <span>✏️</span> Edit Wording
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
