import { useState, useEffect } from "react";
import { resolveHandymanImage } from "../../data/handymanProjects";

const CATEGORY_SUGGESTIONS = [
  "Custom Carpentry & Woodwork",
  "Home Repairs & Improvements",
  "Staircase",
  "Bathroom Remodel",
  "Play Area & Custom Builds",
  "Outdoor & Garden",
];

const ProjectEditModal = ({ project, allProjects = [], isOpen, onClose, onSaved }) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (project) {
      setTitle(project.title || "");
      setCategory(project.category || "");
      setSummary(project.summary || "");
      setDescription(project.description || "");
      setTagsInput(Array.isArray(project.tags) ? project.tags.join(", ") : "");
      setCoverImage(project.rawCoverImage || project.coverImage || "");
      setImages(
        (project.images || []).map((img) => ({
          file: img.rawFile || img.file,
          caption: img.caption || "",
        }))
      );
      setStatusMsg("");
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleCaptionChange = (idx, newCaption) => {
    setImages((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], caption: newCaption };
      return updated;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg("");

    const updatedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const updatedImages = images.map((img) => ({
      file: img.file,
      caption: img.caption.trim(),
    }));

    // Find or fallback cover
    const finalCover = coverImage || (updatedImages[0]?.file ?? "");

    // Build serializable projects array for projects.json
    const updatedAllProjects = allProjects.map((p) => {
      if (p.id === project.id) {
        return {
          id: p.id,
          title: title.trim(),
          category: category.trim(),
          featured: p.featured ?? true,
          summary: summary.trim(),
          description: description.trim(),
          tags: updatedTags,
          coverImage: finalCover,
          images: updatedImages,
        };
      }
      return {
        id: p.id,
        title: p.title,
        category: p.category,
        featured: p.featured ?? true,
        summary: p.summary,
        description: p.description,
        tags: p.tags,
        coverImage: p.rawCoverImage || p.coverImage,
        images: (p.images || []).map((img) => ({
          file: img.rawFile || img.file,
          caption: img.caption || "",
        })),
      };
    });

    try {
      const res = await fetch("/api/save-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedAllProjects),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      setStatusMsg("✅ Saved successfully to projects.json!");
      setTimeout(() => {
        onSaved?.(updatedAllProjects);
        onClose();
      }, 600);
    } catch (err) {
      console.error("Save error:", err);
      setStatusMsg(`❌ Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#100d25] border border-white/15 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#151030]">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div>
              <h2 className="text-lg font-bold text-white">Edit Project Verbiage</h2>
              <p className="text-xs text-secondary">
                Changes save directly to <code className="text-[#915eff]">src/data/projects.json</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-[#151030] border border-white/15 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#915eff] text-sm"
              placeholder="e.g. Interior Double French Doors & Shadowbox Wainscoting"
            />
          </div>

          {/* Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                Category
              </label>
              <input
                type="text"
                list="category-options"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full bg-[#151030] border border-white/15 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#915eff] text-sm"
                placeholder="Select or type category..."
              />
              <datalist id="category-options">
                {CATEGORY_SUGGESTIONS.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                Tags (Comma-Separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full bg-[#151030] border border-white/15 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#915eff] text-sm"
                placeholder="French Doors, Wainscoting, Finish Carpentry"
              />
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
              Short Summary (Shows on front of project card)
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              className="w-full bg-[#151030] border border-white/15 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#915eff] text-sm resize-none"
              placeholder="1-2 sentences summarizing the project..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
              Detailed Description (Shows in expanded modal)
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#151030] border border-white/15 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#915eff] text-sm"
              placeholder="Full scope of work, materials, and craftsmanship details..."
            />
          </div>

          {/* Photos & Captions */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-2">
              Photos ({images.length}) & Captions <span className="text-secondary/70 lowercase font-normal">(click star to set cover)</span>
            </label>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {images.map((img, idx) => {
                const isCover = coverImage === img.file;
                const previewSrc = resolveHandymanImage(img.file);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                      isCover ? "bg-[#915eff]/10 border-[#915eff]" : "bg-[#151030] border-white/10"
                    }`}
                  >
                    <img
                      src={previewSrc}
                      alt={`Photo ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded object-cover flex-shrink-0 border border-white/10"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-secondary truncate">
                          #{idx + 1} {img.file}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCoverImage(img.file)}
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${
                            isCover
                              ? "bg-[#915eff] text-white font-bold"
                              : "bg-white/5 hover:bg-white/15 text-secondary"
                          }`}
                        >
                          {isCover ? "★ Cover Photo" : "Set as Cover"}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={img.caption}
                        onChange={(e) => handleCaptionChange(idx, e.target.value)}
                        placeholder="Enter caption for this photo..."
                        className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#915eff]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3 rounded-lg text-xs font-medium ${
                statusMsg.startsWith("✅") ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
              }`}
            >
              {statusMsg}
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-secondary hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#915eff] hover:bg-[#7e47f2] text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? "Saving..." : "💾 Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectEditModal;
