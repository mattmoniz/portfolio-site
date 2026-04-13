import { BrowserRouter, Routes, Route } from "react-router-dom";

import {
  About,
  Contact,
  Experience,
  Feedback,
  Hero,
  Navbar,
  Tech,
  Projects,
} from "./components";

import Handyman from "./pages/Handyman";

const DevPortfolio = () => (
  <div className="relative z-0 bg-primary">
    <div className="bg-hero-pattern bg-cover bg-no-repeat bg-center">
      <Navbar />
      <Hero />
    </div>
    <About />
    <Experience />
    {/* <Tech /> */}
    <Projects />
    {/* Omitted Feedback for now. Might use in the future. */}
    {/* <Feedback /> */}
    <div className="relative z-0">
      <Contact />
    </div>
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DevPortfolio />} />
        <Route path="/handyman" element={<Handyman />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
