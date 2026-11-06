import { useState, useEffect, useRef } from "react";
import { resolveHandymanImage } from "../../data/handymanProjects";
import { detectPhotoStage, hasBeforeAndAfter } from "./ProjectCard";

const ProjectModal = ({ project, onClose, onInquire, onEdit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [copiedLink, setCopiedLink] = useState(false);
  const touchStartXRef = useRef(null);

  // Reset state whenever a new project is opened
  useEffect(() => {
    if (project) {
      setCurrentIndex(0);
      setCompareMode(false);
      setSliderPosition(50);
      setCopiedLink(false);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [project]);

  // Keyboard navigation
  useEffect(() => {
    if (!project) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (!compareMode && e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : project.images.length - 1));
      } else if (!compareMode && e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev < project.images.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project, compareMode, onClose]);

  if (!project) return null;

  const images = project.images || [];
  const currentImage = images[currentIndex];
  const totalImages = images.length;
  const currentStage = detectPhotoStage(currentImage, currentIndex, totalImages);
  const canCompare = hasBeforeAndAfter(project);

  // Determine "Finished" (after) and "Before / Prep" photos for comparison slider
  const afterImage = images[0];
  const beforeImage =
    [...images]
      .reverse()
      .find((img, revIdx) => {
        const idx = images.length - 1 - revIdx;
        const st = detectPhotoStage(img, idx, totalImages);
        return st === "Before / Prep" || st === "In Progress";
      }) || images[images.length - 1];

  const nextImage = () => {
    setCurrentIndex((prev) => (prev < totalImages - 1 ? prev + 1 : 0));
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalImages - 1));
  };

  // Mobile Touch Swipe Handlers
  const handleTouchStart = (e) => {
    if (compareMode || totalImages <= 1) return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (compareMode || touchStartXRef.current === null || totalImages <= 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > 45) {
      if (deltaX < 0) nextImage();
      else prevImage();
    }
    touchStartXRef.current = null;
  };

  const handleShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("project", project.id);
    navigator.clipboard?.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#100d25] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-white/10 bg-[#151030]/80">
          <div className="flex items-center gap-3 min-w-0">
            <span className="bg-[#915eff]/20 text-[#c4b5fd] text-xs font-semibold px-3 py-1 rounded-full border border-[#915eff]/30 flex-shrink-0">
              {project.category}
            </span>
            <h2 className="text-base sm:text-xl font-bold truncate">
              {project.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Before & After Comparison Toggle */}
            {canCompare && (
              <button
                type="button"
                onClick={() => setCompareMode((prev) => !prev)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  compareMode
                    ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20"
                    : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30"
                }`}
              >
                <span>🔀</span> {compareMode ? "Exit Compare" : "Before / After Slider"}
              </button>
            )}

            {/* Share Direct Link Button */}
            <button
              type="button"
              onClick={handleShareLink}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy direct link to this project"
            >
              <span>{copiedLink ? "✓" : "🔗"}</span>
              <span className="hidden sm:inline">{copiedLink ? "Link Copied!" : "Share"}</span>
            </button>

            {import.meta.env.DEV && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(project)}
                className="bg-[#915eff] hover:bg-[#7e47f2] text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow border border-white/20 transition-all flex items-center gap-1"
              >
                <span>✏️</span> Edit
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-base transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Interactive Before / After Slider OR Standard Lightbox Viewer */}
          {compareMode && beforeImage && afterImage ? (
            <div className="space-y-3">
              <div className="relative bg-black/60 rounded-xl overflow-hidden h-[340px] sm:h-[460px] border border-emerald-500/30 select-none">
                {/* Underlying image: Before / Prep */}
                <img
                  src={resolveHandymanImage(beforeImage.file || beforeImage.src)}
                  alt="Before / Preparation"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-contain bg-black/80"
                />

                {/* Clipped Foreground image: Finished Result */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                >
                  <img
                    src={resolveHandymanImage(afterImage.file || afterImage.src)}
                    alt="Finished Result"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain bg-[#090618]"
                  />
                </div>

                {/* Vertical Divider Handle */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] pointer-events-none"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shadow-lg border-2 border-white">
                    ⇄
                  </div>
                </div>

                {/* Labels */}
                <span className="absolute top-3 left-3 bg-emerald-500/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                  ✨ Finished Result
                </span>
                <span className="absolute top-3 right-3 bg-black/80 text-amber-300 border border-amber-400/30 text-xs font-bold px-3 py-1 rounded-full shadow">
                  🔨 Before / Prep
                </span>

                {/* Invisible Range Input Overlay for smooth touch & mouse dragging */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderPosition}
                  onChange={(e) => setSliderPosition(Number(e.target.value))}
                  aria-label="Before and after comparison slider"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                />
              </div>
              <p className="text-center text-xs text-secondary">
                Drag the slider left or right to compare the preparation stage with the finished result.
              </p>
            </div>
          ) : (
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="relative bg-black/40 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[55vh] border border-white/5"
            >
              {currentImage && (
                <img
                  src={resolveHandymanImage(currentImage.file || currentImage.src)}
                  alt={currentImage.caption || project.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[55vh] w-auto max-w-full object-contain mx-auto transition-opacity duration-200 select-none"
                />
              )}

              {/* Counter + Stage Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="bg-black/70 backdrop-blur-sm text-xs font-medium px-3 py-1.5 rounded-full text-white/90 border border-white/10">
                  📷 {currentIndex + 1} of {totalImages}
                </span>
                {currentStage && (
                  <span
                    className={`backdrop-blur-sm text-xs font-semibold px-3 py-1.5 rounded-full border ${
                      currentStage === "Finished Result"
                        ? "bg-emerald-500/25 text-emerald-300 border-emerald-400/30"
                        : currentStage === "Before / Prep"
                        ? "bg-amber-500/25 text-amber-300 border-amber-400/30"
                        : "bg-[#915eff]/25 text-[#dfd9ff] border-[#915eff]/40"
                    }`}
                  >
                    {currentStage === "Finished Result"
                      ? "✨ Finished Result"
                      : currentStage === "Before / Prep"
                      ? "📸 Before / Prep"
                      : "🔨 In Progress"}
                  </span>
                )}
              </div>

              {/* Prev / Next buttons */}
              {totalImages > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/20 shadow-lg text-lg focus:outline-none cursor-pointer"
                    aria-label="Previous photo"
                  >
                    ‹
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/20 shadow-lg text-lg focus:outline-none cursor-pointer"
                    aria-label="Next photo"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Caption bar */}
              {currentImage?.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 text-center">
                  <p className="text-sm text-white/90 font-medium">
                    {currentImage.caption}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Thumbnail Carousel Strip */}
          {totalImages > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20">
              {images.map((img, idx) => {
                const thumbStage = detectPhotoStage(img, idx, totalImages);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setCompareMode(false);
                      setCurrentIndex(idx);
                    }}
                    className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      !compareMode && idx === currentIndex
                        ? "border-[#915eff] scale-105 shadow-md shadow-[#915eff]/30"
                        : "border-white/10 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={resolveHandymanImage(img.file || img.src)}
                      alt={img.caption || `Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {thumbStage === "Finished Result" && idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-emerald-600/85 text-[9px] text-white font-bold text-center py-0.2">
                        AFTER
                      </span>
                    )}
                    {thumbStage === "Before / Prep" && (
                      <span className="absolute bottom-0 inset-x-0 bg-amber-600/85 text-[9px] text-white font-bold text-center py-0.2">
                        PREP
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Project Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>📋</span> Project Overview
              </h3>
              <p className="text-secondary text-sm sm:text-base leading-relaxed">
                {project.description || project.summary}
              </p>
            </div>

            <div className="space-y-3 bg-[#151030] p-4 rounded-xl border border-white/5">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-[#915eff]">
                Key Skills &amp; Materials
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {project.tags?.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs bg-black-200 text-[#dfd9ff] px-2.5 py-1 rounded-md border border-white/5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#151030] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-secondary text-center sm:text-left">
            Have a similar home improvement project in mind?
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                onClose();
                onInquire?.(project.title);
              }}
              className="flex-1 sm:flex-none bg-[#915eff] hover:bg-[#7e47f2] text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors shadow-md cursor-pointer"
            >
              Request an Estimate for This Project
            </button>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectModal;
