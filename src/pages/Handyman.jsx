import { useState } from "react";
import { Link } from "react-router-dom";
import { styles } from "../styles";

import bathroomVanity1 from "../assets/handyman/bathroom-vanity-1.jpg";
import bathroomVanity2 from "../assets/handyman/bathroom-vanity-2.jpg";
import bathroomVanity3 from "../assets/handyman/bathroom-vanity-3.jpg";
import bathroomVanity4 from "../assets/handyman/bathroom-vanity-4.jpg";
import bathroomVanity5 from "../assets/handyman/bathroom-vanity-5.jpg";
import playarea1 from "../assets/handyman/playarea-1.jpg";
import playarea2 from "../assets/handyman/playarea-2.jpg";
import raisedBed1 from "../assets/handyman/raised-bed-1.jpg";
import raisedBed3 from "../assets/handyman/raised-bed-3.jpg";
import raisedBed4 from "../assets/handyman/raised-bed-4.jpg";
import downstairsBathroom1 from "../assets/handyman/downstairs-bathroom-1.jpg";
import downstairsBathroom2 from "../assets/handyman/downstairs-bathroom-2.jpg";
import downstairsBathroom3 from "../assets/handyman/downstairs-bathroom-3.jpg";
import staircase1 from "../assets/handyman/staircase-1.jpg";
import staircase2 from "../assets/handyman/staircase-2.jpg";
import staircase3 from "../assets/handyman/staircase-3.jpg";
import staircase4 from "../assets/handyman/staircase-4.jpg";
import staircase5 from "../assets/handyman/staircase-5.jpg";
import staircase6 from "../assets/handyman/staircase-6.jpg";
import staircase7 from "../assets/handyman/staircase-7.jpg";
import staircase8 from "../assets/handyman/staircase-8.jpg";
import staircase9 from "../assets/handyman/staircase-9.jpg";

const photos = [
  { src: bathroomVanity1, category: "Bathroom & Vanity", label: "Bathroom & Vanity Remodel" },
  { src: bathroomVanity2, category: "Bathroom & Vanity", label: "Bathroom & Vanity Remodel" },
  { src: bathroomVanity3, category: "Bathroom & Vanity", label: "Bathroom & Vanity Remodel" },
  { src: bathroomVanity4, category: "Bathroom & Vanity", label: "Bathroom & Vanity Remodel" },
  { src: bathroomVanity5, category: "Bathroom & Vanity", label: "Bathroom & Vanity Remodel" },
  { src: playarea1,       category: "Play Area",         label: "Play Area Build" },
  { src: playarea2,       category: "Play Area",         label: "Play Area Build" },
  { src: raisedBed1,      category: "Garden & Fence",    label: "Raised Bed Garden & Fence" },
  { src: raisedBed3,      category: "Garden & Fence",    label: "Raised Bed Garden & Fence" },
  { src: raisedBed4,      category: "Garden & Fence",    label: "Raised Bed Garden & Fence" },
  { src: downstairsBathroom1, category: "Downstairs Bathroom", label: "Downstairs Bathroom Remodel" },
  { src: downstairsBathroom2, category: "Downstairs Bathroom", label: "Downstairs Bathroom Remodel" },
  { src: downstairsBathroom3, category: "Downstairs Bathroom", label: "Downstairs Bathroom Remodel" },
  { src: staircase1,      category: "Staircase",         label: "Staircase" },
  { src: staircase2,      category: "Staircase",         label: "Staircase" },
  { src: staircase3,      category: "Staircase",         label: "Staircase" },
  { src: staircase4,      category: "Staircase",         label: "Staircase" },
  { src: staircase5,      category: "Staircase",         label: "Staircase" },
  { src: staircase6,      category: "Staircase",         label: "Staircase" },
  { src: staircase7,      category: "Staircase",         label: "Staircase" },
  { src: staircase8,      category: "Staircase",         label: "Staircase" },
  { src: staircase9,      category: "Staircase",         label: "Staircase" },
];

const categories = ["All", "Bathroom & Vanity", "Downstairs Bathroom", "Staircase", "Play Area", "Garden & Fence"];

const Handyman = () => {
  const [active, setActive] = useState("All");
  const [lightbox, setLightbox] = useState(null);

  const filtered = active === "All" ? photos : photos.filter((p) => p.category === active);

  return (
    <div className="relative z-0 bg-primary min-h-screen">

      {/* Navbar */}
      <nav className={`${styles.paddingX} w-full flex items-center py-5 fixed top-0 z-20 bg-primary`}>
        <div className="w-full flex justify-between items-center max-w-7xl mx-auto">
          <p className="text-white text-[18px] font-bold">
            Matt Moniz <span className="text-[#915eff]">| Handyman</span>
          </p>
          <Link
            to="/"
            className="text-secondary hover:text-white text-[14px] sm:text-[16px] font-medium transition-colors"
          >
            ← Dev Portfolio
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={`${styles.paddingX} pt-28 pb-10 max-w-7xl mx-auto`}>
        <h1 className={`${styles.heroHeadText} text-white`}>
          Handyman <span className="text-[#915eff]">Work Examples</span>
        </h1>
        <p className={`${styles.heroSubText} mt-4 text-white-100 max-w-3xl`}>
          A collection of hands-on projects I've taken on — from bathroom remodels
          and staircases to raised garden beds and custom play areas. Built with care, start to finish.
        </p>
      </section>

      {/* Filter Buttons */}
      <section className={`${styles.paddingX} max-w-7xl mx-auto pb-6`}>
        <div className="flex flex-wrap gap-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`py-2 px-4 rounded-full text-[14px] font-medium transition-colors ${
                active === cat
                  ? "bg-[#915eff] text-white"
                  : "bg-tertiary text-secondary hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Gallery Grid */}
      <section className={`${styles.paddingX} max-w-7xl mx-auto pb-20`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((photo, index) => (
            <div
              key={index}
              className="relative group cursor-pointer overflow-hidden rounded-2xl"
              onClick={() => setLightbox(photo)}
            >
              <img
                src={photo.src}
                alt={photo.label}
                loading="lazy"
                className="w-full h-[250px] object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-end">
                <p className="text-white text-[14px] font-medium p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                  {photo.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-5 right-5 text-white text-[28px] font-bold"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.label}
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-6 text-white text-[14px] font-medium">
            {lightbox.label}
          </p>
        </div>
      )}
    </div>
  );
};

export default Handyman;
