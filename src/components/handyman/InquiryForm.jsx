import { useState, useRef, useEffect } from "react";
import emailjs from "@emailjs/browser";

const InquiryForm = ({ initialProjectType = "" }) => {
  const formRef = useRef();
  const lastSubmitRef = useRef(0);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    contactPreference: "Text or Call",
    location: "",
    projectType: initialProjectType || "General Inquiry",
    timeframe: "Flexible / Whenever Available",
    message: "",
    websiteHoneypot: "", // Anti-bot honeypot field
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Update projectType if passed from modal or service card
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

    // 1. Silent Honeypot Check (blocks automated spam bots)
    if (form.websiteHoneypot) {
      setSubmitted(true);
      return;
    }

    // 2. Client Rate-Limit Check (30s cooldown)
    const now = Date.now();
    if (now - lastSubmitRef.current < 30000) {
      setErrorMessage("Please wait a moment before submitting another request.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY_ID;

    // Build the formatted message to include phone, contact preference, timeframe, location & project type
    const fullMessage = [
      `Project Type: ${form.projectType}`,
      `Town/Location: ${form.location || "Not specified"}`,
      `Phone Number: ${form.phone || "Not provided"}`,
      `Preferred Contact: ${form.contactPreference}`,
      `Target Timeframe: ${form.timeframe}`,
      ``,
      `Project Scope & Details:`,
      form.message,
    ].join("\n");

    if (!serviceId || !templateId || !publicKey) {
      console.warn("EmailJS credentials not detected in environment variables.");
      lastSubmitRef.current = Date.now();
      setTimeout(() => {
        setLoading(false);
        setSubmitted(true);
      }, 600);
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
          lastSubmitRef.current = Date.now();
          setLoading(false);
          setSubmitted(true);
          setForm({
            name: "",
            email: "",
            phone: "",
            contactPreference: "Text or Call",
            location: "",
            projectType: "General Inquiry",
            timeframe: "Flexible / Whenever Available",
            message: "",
            websiteHoneypot: "",
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
              Your inquiry has been received. I review every project carefully and will follow up with you promptly via your preferred contact method.
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

            {/* Anti-spam honeypot field (hidden from real users) */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website-honeypot">Website</label>
              <input
                id="website-honeypot"
                type="text"
                name="websiteHoneypot"
                tabIndex={-1}
                autoComplete="off"
                value={form.websiteHoneypot}
                onChange={handleChange}
              />
            </div>

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
              {/* Phone Number */}
              <div className="flex flex-col gap-2">
                <label htmlFor="client-phone" className="text-white text-sm font-medium">
                  Phone Number <span className="text-secondary text-xs font-normal">(Optional)</span>
                </label>
                <input
                  id="client-phone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. (508) 555-0199"
                  className="bg-black-100 border border-white/10 focus:border-[#915eff] rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                />
              </div>

              {/* Preferred Contact Method */}
              <div className="flex flex-col gap-2">
                <label htmlFor="client-contact-pref" className="text-white text-sm font-medium">
                  Preferred Contact Method
                </label>
                <select
                  id="client-contact-pref"
                  name="contactPreference"
                  value={form.contactPreference}
                  onChange={handleChange}
                  className="bg-black-100 border border-white/10 focus:border-[#915eff] rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                >
                  <option value="Text or Call">Text or Call</option>
                  <option value="Text Message">Text Message</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Email">Email</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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
                  placeholder="e.g. Plymouth, Quincy..."
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

              {/* Target Timeframe */}
              <div className="flex flex-col gap-2">
                <label htmlFor="client-timeframe" className="text-white text-sm font-medium">
                  Ideal Timeframe
                </label>
                <select
                  id="client-timeframe"
                  name="timeframe"
                  value={form.timeframe}
                  onChange={handleChange}
                  className="bg-black-100 border border-white/10 focus:border-[#915eff] rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                >
                  <option value="Flexible / Whenever Available">Flexible / Whenever Available</option>
                  <option value="As Soon As Possible">As Soon As Possible</option>
                  <option value="Within 2-4 Weeks">Within 2–4 Weeks</option>
                  <option value="Planning Ahead (1-3 Months)">Planning Ahead (1–3 Months)</option>
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
                rows="4"
                value={form.message}
                onChange={handleChange}
                placeholder="Tell me a bit about what you need done, any rough dimensions, or questions you have..."
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
                className="w-full sm:w-auto bg-[#915eff] hover:bg-[#7e47f2] disabled:opacity-50 text-white font-bold py-3.5 px-8 rounded-xl transition-colors shadow-lg shadow-[#915eff]/20 flex items-center justify-center gap-2 cursor-pointer"
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
