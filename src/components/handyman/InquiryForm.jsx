import { useState, useRef, useEffect } from "react";
import emailjs from "@emailjs/browser";

const InquiryForm = ({ initialProjectType = "" }) => {
  const formRef = useRef();
  const [form, setForm] = useState({
    name: "",
    email: "",
    location: "",
    projectType: initialProjectType || "General Inquiry",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Update projectType if passed from modal
  useEffect(() => {
    if (initialProjectType) {
      setForm((prev) => ({ ...prev, projectType: initialProjectType }));
    }
  }, [initialProjectType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY_ID;

    // Build the formatted message to include location & project type
    const fullMessage = `Project Type: ${form.projectType}\nTown/Location: ${
      form.location || "Not specified"
    }\n\nProject Scope & Details:\n${form.message}`;

    if (!serviceId || !templateId || !publicKey) {
      // Graceful fallback for local development if env vars aren't loaded
      console.warn("EmailJS credentials not detected in environment variables.");
      setTimeout(() => {
        setLoading(false);
        setSubmitted(true);
      }, 800);
      return;
    }

    emailjs
      .send(
        serviceId,
        templateId,
        {
          from_name: form.name,
          to_name: "Matthew Moniz (Handyman Services)",
          from_email: form.email,
          to_email: "monizri@gmail.com",
          message: fullMessage,
        },
        publicKey
      )
      .then(
        () => {
          setLoading(false);
          setSubmitted(true);
          setForm({
            name: "",
            email: "",
            location: "",
            projectType: "General Inquiry",
            message: "",
          });
        },
        (err) => {
          setLoading(false);
          console.error("EmailJS Error:", err);
          setErrorMessage("Something went wrong while sending your request. Please try again.");
        }
      );
  };

  return (
    <div id="inquiry" className="scroll-mt-28 w-full max-w-4xl mx-auto">
      <div className="bg-[#151030] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#915eff]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-[#915eff] text-xs sm:text-sm font-semibold tracking-wider uppercase">
            Let&apos;s Talk About Your Home
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
            Request an Estimate
          </h2>
          <p className="text-secondary text-sm sm:text-base mt-2">
            Serving South Eastern Massachusetts &amp; the South Shore. Share a few details about your project and I&apos;ll get back to you with next steps.
          </p>
        </div>

        {submitted ? (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-2xl mx-auto">
              ✓
            </div>
            <h3 className="text-xl font-bold text-white">Thank You for Reaching Out!</h3>
            <p className="text-secondary text-sm max-w-md mx-auto">
              Your inquiry has been received. I review every project carefully and will get back to you promptly.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 bg-tertiary hover:bg-[#1c1642] text-white text-xs font-semibold py-2.5 px-6 rounded-lg transition-colors border border-white/10"
            >
              Send Another Request
            </button>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-sm">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Name */}
              <div className="flex flex-col gap-2">
                <label htmlFor="client-name" className="text-white text-sm font-medium">
                  Your Name <span className="text-[#915eff]">*</span>
                </label>
                <input
                  id="client-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Jane Doe"
                  required
                  className="bg-black-100 border border-white/10 focus:border-[#915eff] rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <label htmlFor="client-email" className="text-white text-sm font-medium">
                  Email Address <span className="text-[#915eff]">*</span>
                </label>
                <input
                  id="client-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  required
                  className="bg-black-100 border border-white/10 focus:border-[#915eff] rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Town / Location */}
              <div className="flex flex-col gap-2">
                <label htmlFor="client-location" className="text-white text-sm font-medium">
                  Town / Location
                </label>
                <input
                  id="client-location"
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. Plymouth, Braintree, Quincy..."
                  className="bg-black-100 border border-white/10 focus:border-[#915eff] rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                />
              </div>

              {/* Project Type */}
              <div className="flex flex-col gap-2">
                <label htmlFor="client-project-type" className="text-white text-sm font-medium">
                  Project Type
                </label>
                <select
                  id="client-project-type"
                  name="projectType"
                  value={form.projectType}
                  onChange={handleChange}
                  className="bg-black-100 border border-white/10 focus:border-[#915eff] rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Bathroom & Vanity Remodel">Bathroom & Vanity Remodel</option>
                  <option value="Staircase & Railing">Staircase & Railing</option>
                  <option value="Custom Carpentry & Built-Ins">Custom Carpentry & Built-Ins</option>
                  <option value="Garden & Outdoor Builds">Garden & Outdoor Builds</option>
                  <option value="Play Area & Custom Builds">Play Area & Custom Builds</option>
                  <option value="Home Repairs & Maintenance">Home Repairs & Maintenance</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Message / Scope */}
            <div className="flex flex-col gap-2">
              <label htmlFor="client-message" className="text-white text-sm font-medium">
                Project Scope & Details <span className="text-[#915eff]">*</span>
              </label>
              <textarea
                id="client-message"
                name="message"
                rows="5"
                value={form.message}
                onChange={handleChange}
                placeholder="Tell me a bit about what you need done, any rough dimensions, or your ideal timeframe..."
                required
                className="bg-black-100 border border-white/10 focus:border-[#915eff] rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors resize-y"
              />
            </div>

            {/* Privacy notice + submit */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-xs text-secondary/80 flex items-center gap-1.5 text-center sm:text-left">
                <span>🔒</span> Your contact details are kept private and never shared.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto bg-[#915eff] hover:bg-[#7e47f2] disabled:opacity-50 text-white font-bold py-3.5 px-8 rounded-xl transition-colors shadow-lg shadow-[#915eff]/20 flex items-center justify-center gap-2"
              >
                {loading ? "Sending..." : "Submit Inquiry"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InquiryForm;
