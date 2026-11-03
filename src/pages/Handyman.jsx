import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  handymanProjects,
  handymanServices,
  serviceAreaInfo,
  resolveHandymanImage,
} from "../data/handymanProjects";
import ProjectCard from "../components/handyman/ProjectCard";
import ProjectModal from "../components/handyman/ProjectModal";
import ProjectEditModal from "../components/handyman/ProjectEditModal";
import InquiryForm from "../components/handyman/InquiryForm";

const Handyman = () => {
  const [projectsList, setProjectsList] = useState(handymanProjects);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [inquiryType, setInquiryType] = useState("");

  // Dynamically extract categories with their counts
  const categoriesWithCounts = useMemo(() => {
    const counts = { All: projectsList.length };
    projectsList.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });

    const uniqueCats = ["All", ...new Set(projectsList.map((p) => p.category))];
    return uniqueCats.map((cat) => ({
      name: cat,
      count: counts[cat] || 0,
    }));
  }, [projectsList]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (activeCategory === "All") return projectsList;
    return projectsList.filter((p) => p.category === activeCategory);
  }, [activeCategory, projectsList]);

  const handleOpenProjectInquiry = (projectTitle) => {
    setInquiryType(projectTitle);
    const inquiryEl = document.getElementById("inquiry");
    if (inquiryEl) {
      inquiryEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative z-0 bg-primary min-h-screen text-white selection:bg-[#915eff] selection:text-white">
      {/* Sticky Blur Navbar */}
      <header className="sticky top-0 z-40 bg-primary/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/handyman" className="flex items-center gap-2 group">
              <span className="text-xl">🛠️</span>
              <p className="text-white text-base sm:text-lg font-extrabold tracking-tight group-hover:text-[#915eff] transition-colors">
                Matt Moniz <span className="text-[#915eff] font-semibold">| Handyman</span>
              </p>
            </Link>
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-medium bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-secondary">
              <span>📍</span> {serviceAreaInfo.primaryArea}
            </span>
          </div>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
            <a
              href="#projects"
              className="text-secondary hover:text-white transition-colors hidden sm:inline"
            >
              Projects
            </a>
            <a
              href="#services"
              className="text-secondary hover:text-white transition-colors hidden sm:inline"
            >
              Services
            </a>
            <a
              href="#inquiry"
              className="bg-[#915eff] hover:bg-[#7e47f2] text-white px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-semibold shadow-md shadow-[#915eff]/20"
            >
              Free Estimate
            </a>
            <Link
              to="/"
              className="text-secondary hover:text-white transition-colors border-l border-white/10 pl-4 sm:pl-6 text-xs sm:text-sm"
              title="Return to Developer Portfolio"
            >
              ← Dev Portfolio
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-16 px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Background glow circle */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#915eff]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-[#915eff]/10 border border-[#915eff]/30 text-[#c4b5fd] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span>📍</span> Serving South Eastern MA & the South Shore
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight">
            Quality Craftsmanship, <br />
            <span className="text-[#915eff]">Built With Care.</span>
          </h1>

          <p className="mt-5 text-secondary text-base sm:text-lg leading-relaxed max-w-2xl">
            From custom hardwood staircases and full bathroom refreshes to outdoor garden builds and home repairs. Every project is executed with precision, clean job sites, and honest communication from start to finish.
          </p>

          <div className="mt-8 flex flex-wrap gap-4 items-center">
            <a
              href="#inquiry"
              className="bg-[#915eff] hover:bg-[#7e47f2] text-white font-bold py-3.5 px-7 rounded-xl transition-all shadow-lg shadow-[#915eff]/25 hover:-translate-y-0.5 text-sm sm:text-base"
            >
              Request a Free Estimate
            </a>
            <a
              href="#projects"
              className="bg-[#151030] hover:bg-[#1c1642] text-white font-medium py-3.5 px-6 rounded-xl transition-all border border-white/10 text-sm sm:text-base flex items-center gap-2"
            >
              <span>Explore Projects</span>
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-secondary">
                {projectsList.length}
              </span>
            </a>
          </div>

          {/* Trust Badges */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-white/10 pt-8">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📐</span>
              <span className="text-xs font-medium text-white/90">Custom Carpentry</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🚿</span>
              <span className="text-xs font-medium text-white/90">Bathroom Updates</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🧹</span>
              <span className="text-xs font-medium text-white/90">Clean Workspaces</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💬</span>
              <span className="text-xs font-medium text-white/90">Clear Estimates</span>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Showcase */}
      <section id="projects" className="scroll-mt-24 px-4 sm:px-8 max-w-7xl mx-auto py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-[#915eff] text-xs sm:text-sm font-semibold tracking-wider uppercase">
              Portfolio
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
              Featured Projects
            </h2>
            <p className="text-secondary text-sm sm:text-base mt-2 max-w-xl">
              Select any project to view complete photo galleries, construction details, and materials.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
            {categoriesWithCounts.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`py-2 px-3.5 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                  activeCategory === cat.name
                    ? "bg-[#915eff] text-white shadow-md shadow-[#915eff]/30"
                    : "bg-[#151030] text-secondary hover:text-white border border-white/5 hover:border-white/20"
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeCategory === cat.name
                      ? "bg-white/25 text-white"
                      : "bg-white/10 text-secondary"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={setSelectedProject}
              onEdit={setEditingProject}
            />
          ))}
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="scroll-mt-24 px-4 sm:px-8 max-w-7xl mx-auto py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[#915eff] text-xs sm:text-sm font-semibold tracking-wider uppercase">
            Capabilities
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
            Services Offered
          </h2>
          <p className="text-secondary text-sm sm:text-base mt-2">
            Quality craftsmanship tailored to your home improvement needs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {handymanServices.map((service, index) => (
            <div
              key={index}
              className="bg-[#151030] border border-white/10 rounded-2xl p-6 hover:border-[#915eff]/40 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className="text-3xl block">{service.icon}</span>
                <h3 className="text-lg font-bold text-white">{service.title}</h3>
                <p className="text-secondary text-sm leading-relaxed">
                  {service.description}
                </p>
              </div>
              <a
                href="#inquiry"
                onClick={() => setInquiryType(service.title)}
                className="mt-6 text-xs font-semibold text-[#915eff] hover:text-white flex items-center gap-1 transition-colors"
              >
                Inquire about this <span>→</span>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-8 max-w-7xl mx-auto py-12">
        <div className="bg-[#100d25] border border-white/10 rounded-3xl p-6 sm:p-12">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[#915eff] text-xs sm:text-sm font-semibold tracking-wider uppercase">
              The Process
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              How I Work
            </h2>
            <p className="text-secondary text-sm mt-2">
              Straightforward, communicative, and respectful of your home.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#151030]/60 p-5 rounded-xl border border-white/5 space-y-2">
              <span className="w-8 h-8 rounded-full bg-[#915eff]/20 text-[#c4b5fd] flex items-center justify-center text-sm font-bold border border-[#915eff]/30">
                1
              </span>
              <h4 className="text-white font-bold text-base pt-1">Initial Contact</h4>
              <p className="text-secondary text-xs sm:text-sm leading-relaxed">
                Submit a project description. We&apos;ll discuss your goals, timeline, and rough dimensions.
              </p>
            </div>

            <div className="bg-[#151030]/60 p-5 rounded-xl border border-white/5 space-y-2">
              <span className="w-8 h-8 rounded-full bg-[#915eff]/20 text-[#c4b5fd] flex items-center justify-center text-sm font-bold border border-[#915eff]/30">
                2
              </span>
              <h4 className="text-white font-bold text-base pt-1">Scope & Estimate</h4>
              <p className="text-secondary text-xs sm:text-sm leading-relaxed">
                Transparent discussion of materials, labor, and approach with no surprise hidden fees.
              </p>
            </div>

            <div className="bg-[#151030]/60 p-5 rounded-xl border border-white/5 space-y-2">
              <span className="w-8 h-8 rounded-full bg-[#915eff]/20 text-[#c4b5fd] flex items-center justify-center text-sm font-bold border border-[#915eff]/30">
                3
              </span>
              <h4 className="text-white font-bold text-base pt-1">Careful Execution</h4>
              <p className="text-secondary text-xs sm:text-sm leading-relaxed">
                Punctual, focused craftsmanship with protected work zones and daily cleanups.
              </p>
            </div>

            <div className="bg-[#151030]/60 p-5 rounded-xl border border-white/5 space-y-2">
              <span className="w-8 h-8 rounded-full bg-[#915eff]/20 text-[#c4b5fd] flex items-center justify-center text-sm font-bold border border-[#915eff]/30">
                4
              </span>
              <h4 className="text-white font-bold text-base pt-1">Final Walkthrough</h4>
              <p className="text-secondary text-xs sm:text-sm leading-relaxed">
                We review the completed work together to make sure every finish meets your standards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Inquiry Form Section */}
      <section className="px-4 sm:px-8 max-w-7xl mx-auto py-12">
        <InquiryForm initialProjectType={inquiryType} />
      </section>

      {/* Project Lightbox & Details Modal */}
      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onInquire={handleOpenProjectInquiry}
        onEdit={(p) => {
          setSelectedProject(null);
          setEditingProject(p);
        }}
      />

      {/* In-Browser Project Edit Modal (Local Dev) */}
      <ProjectEditModal
        project={editingProject}
        allProjects={projectsList}
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSaved={(updatedProjects) => {
          const resolved = updatedProjects.map((p) => ({
            ...p,
            coverImage: resolveHandymanImage(p.coverImage),
            rawCoverImage: p.coverImage,
            images: (p.images || []).map((img) => ({
              ...img,
              file: resolveHandymanImage(img.file),
              rawFile: img.file,
            })),
          }));
          setProjectsList(resolved);
        }}
      />

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#090325] py-10 px-4 sm:px-8 mt-16 text-center text-xs text-secondary space-y-3">
        <p className="font-semibold text-white/90">
          Matt Moniz Handyman Services • Serving South Eastern Massachusetts & South Shore
        </p>
        <p>
          Have questions or a custom carpentry idea? Use the estimate form above to get in touch.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="text-[#915eff] hover:underline font-medium inline-flex items-center gap-1"
          >
            ← Back to Software Developer Portfolio
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Handyman;
