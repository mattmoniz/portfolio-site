# matt-portfolio-site Project Rules & Scope

## Autonomous Scope & Permissions
- Within `/Users/matthewmoniz/Documents/portfolio/matt-portfolio-site`, the agent is permitted to autonomously inspect, create, and edit code and asset files.
- The agent is fully authorized to execute any terminal commands, bash scripts, and curl operations (`command(*)`) anywhere on the system as requested by the user, without pausing for confirmation.
- File writes outside this repository directory still require explicit user direction.

## Project Structure
- `src/pages/Handyman.jsx`: Handyman work examples, gallery, and service inquiry page (`/handyman`).
- `src/components/handyman/`: Handyman components (`InquiryForm.jsx`, `ProjectCard.jsx`, `ProjectModal.jsx`).
- `src/data/handymanProjects.js`: Project data and image bundler (`import.meta.glob`).
- `src/assets/handyman/`: Gallery image assets.
