import { useState, useEffect } from "react";
import { resolveHandymanImage } from "../../data/handymanProjects";

const ProjectModal = ({ project, onClose, onInquire, onEdit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset to first image whenever a new project is opened
  useEffect(() => {
    if (project) {
      setCurrentIndex(0);
      // Prevent background scrolling while modal is open
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
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : project.images.length - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev < project.images.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project, onClose]);

  if (!project) return null;

  const images = project.images || [];
  const currentImage = images[currentIndex];
  const totalImages = images.length;

  const nextImage = () => {
    setCurrentIndex((prev) => (prev < totalImages - 1 ? prev + 1 : 0));
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalImages - 1));
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#151030]/80">
          <div className="flex items-center gap-3">
            <span className="bg-[#915eff]/20 text-[#c4b5fd] text-xs font-semibold px-3 py-1 rounded-full border border-[#915eff]/30">
              {project.category}
            </span>
            <h2 className="text-lg sm:text-xl font-bold truncate max-w-xs sm:max-w-lg">
              {project.title}
            </h2>
            {import.meta.env.DEV && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(project)}
                className="bg-[#915eff] hover:bg-[#7e47f2] text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow border border-white/20 transition-all hover:scale-105 flex items-center gap-1 flex-shrink-0"
              >
                <span>✏️</span> Edit
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Main Photo Viewer */}
          <div className="relative bg-black/40 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[55vh] border border-white/5">
            {currentImage && (
              <img
                src={resolveHandymanImage(currentImage.file || currentImage.src)}
                alt={currentImage.caption || project.title}
                referrerPolicy="no-referrer"
                className="max-h-[55vh] w-auto max-w-full object-contain mx-auto transition-opacity duration-200 select-none"
              />
            )}

            {/* Counter badge */}
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-xs font-medium px-3 py-1.5 rounded-full text-white/90 border border-white/10">
              📷 {currentIndex + 1} of {totalImages}
            </div>

            {/* Prev / Next buttons */}
            {totalImages > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/20 shadow-lg text-lg focus:outline-none"
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/20 shadow-lg text-lg focus:outline-none"
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

          {/* Thumbnail Carousel Strip */}
          {totalImages > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === currentIndex
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
                </button>
              ))}
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
                Key Skills & Materials
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
              className="flex-1 sm:flex-none bg-[#915eff] hover:bg-[#7e47f2] text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors shadow-md"
            >
              Request an Estimate for This Project
            </button>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
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
