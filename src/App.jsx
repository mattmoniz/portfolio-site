import { BrowserRouter } from "react-router-dom";


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

const App = () => {
  return (
    <BrowserRouter>
      <div className="relative z-0 bg-primary">
        <div className="bg-hero-pattern bg-cover bg-no-repeat bg-center">
          <Navbar />
          <Hero />
        </div>
        <About />
        <Experience />
        <Tech />
        <Projects />
        {/* Omitted Feedback for now. Might use in the future. */}
        {/* <Feedback /> */}
        <div className="relative z-0">
          <Contact />
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
