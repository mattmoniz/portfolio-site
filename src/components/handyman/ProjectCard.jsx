import { resolveHandymanImage } from "../../data/handymanProjects";

const ProjectCard = ({ project, onSelect, onEdit }) => {
  const coverSrc = resolveHandymanImage(project.coverImage || project.images?.[0]?.file || project.images?.[0]?.src);
  const photoCount = project.images?.length || 1;

  return (
    <div
      onClick={() => onSelect(project)}
      className="group relative bg-[#151030] hover:bg-[#1c1642] border border-white/10 hover:border-[#915eff]/50 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#915eff]/10 cursor-pointer flex flex-col h-full"
    >
      {/* Cover Image Container */}
      <div className="relative h-60 w-full overflow-hidden bg-black/40">
        <img
          src={coverSrc}
          alt={project.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#151030] via-transparent to-black/20" />

        {/* Category Pill */}
        <div className="absolute top-3 left-3">
          <span className="bg-black/60 backdrop-blur-md text-[#dfd9ff] border border-white/15 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
            {project.category}
          </span>
        </div>

        {/* Photo Count Badge */}
        <div className="absolute top-3 right-3">
          <span className="bg-black/60 backdrop-blur-md text-white/90 border border-white/15 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <span>📷</span> {photoCount} {photoCount === 1 ? "photo" : "photos"}
          </span>
        </div>

        {/* Local Dev Edit Button */}
        {import.meta.env.DEV && onEdit && (
          <div className="absolute bottom-3 right-3 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project);
              }}
              className="bg-[#915eff] hover:bg-[#7e47f2] text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-lg border border-white/20 transition-all hover:scale-105 flex items-center gap-1"
              title="Edit project verbiage"
            >
              <span>✏️</span> Edit
            </button>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-6 flex flex-col flex-1 justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white group-hover:text-[#915eff] transition-colors leading-snug">
            {project.title}
          </h3>
          <p className="text-secondary text-sm line-clamp-3 leading-relaxed">
            {project.summary}
          </p>
        </div>

        {/* Tags */}
        <div className="space-y-4 pt-2 border-t border-white/5">
          <div className="flex flex-wrap gap-1.5">
            {project.tags?.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium bg-black-200/80 text-secondary px-2.5 py-1 rounded-md border border-white/5"
              >
                {tag}
              </span>
            ))}
            {project.tags?.length > 3 && (
              <span className="text-[11px] font-medium text-secondary/70 self-center">
                +{project.tags.length - 3} more
              </span>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between text-sm font-semibold text-[#915eff] group-hover:text-white transition-colors">
            <span>View Project & Gallery</span>
            <span className="transform transition-transform group-hover:translate-x-1">→</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
