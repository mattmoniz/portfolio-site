// Automatically bundle all images inside src/assets/handyman
const handymanImageModules = import.meta.glob(
  "../assets/handyman/*.{jpg,jpeg,png,webp,svg,JPG,JPEG,PNG,WEBP}",
  { eager: true, import: "default" }
);

// Map simple filenames (e.g. "staircase-1.jpg") to their bundled URLs
const imageMap = {};
for (const path in handymanImageModules) {
  const filename = path.split("/").pop();
  imageMap[filename] = handymanImageModules[path];
}

/**
 * Resolves an image filename (e.g. "bathroom-vanity-1.jpg") or URL
 */
export const resolveHandymanImage = (img) => {
  if (!img) return "";
  if (typeof img === "string") {
    // If it's a simple filename found in our assets/handyman folder
    if (imageMap[img]) return imageMap[img];
    return img;
  }
  return img;
};

import rawProjects from "./projects.json";

/**
 * Handyman Projects Data (Unified from src/data/projects.json)
 */
export const handymanProjects = rawProjects.map((p) => ({
  ...p,
  coverImage: resolveHandymanImage(p.coverImage),
  rawCoverImage: p.coverImage,
  images: (p.images || []).map((img) => ({
    ...img,
    file: resolveHandymanImage(img.file),
    rawFile: img.file,
  })),
}));

/**
 * Handyman Services Offered
 */
export const handymanServices = [
  {
    icon: "🔨",
    title: "Custom Carpentry & Woodwork",
    description:
      "Hardwood staircases, custom treads & risers, handrails, interior trim, baseboards, and custom built-in nooks.",
  },
  {
    icon: "🚿",
    title: "Bathroom & Vanity Updates",
    description:
      "Vanity replacements, faucet & fixture updates, mirror mounting, caulking & sealing, and complete bathroom refreshes.",
  },
  {
    icon: "🌱",
    title: "Outdoor & Garden Builds",
    description:
      "Raised cedar garden beds, protective pest fencing, custom gates, outdoor play structures, and exterior wood repairs.",
  },
  {
    icon: "🏡",
    title: "Home Repairs & Installations",
    description:
      "Door hardware, drywall patching, shelving, TV mounting, lighting/fan fixture replacements, and general punch lists.",
  },
];

/**
 * Service Area details
 */
export const serviceAreaInfo = {
  primaryArea: "South Eastern Massachusetts & South Shore",
  townsServed: "Plymouth County, Norfolk County, Bristol County & surrounding communities",
};
