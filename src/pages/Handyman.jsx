import { Link } from "react-router-dom";
import { styles } from "../styles";

const Handyman = () => {
  return (
    <div className="relative z-0 bg-primary min-h-screen">
      {/* Navbar */}
      <nav className={`${styles.paddingX} w-full flex items-center py-5 fixed top-0 z-20 bg-primary`}>
        <div className="w-full flex justify-between items-center max-w-7xl mx-auto">
          <p className="text-white text-[18px] font-bold">
            Matt Moniz &nbsp;
            <span className="text-[#915eff]">| Handyman</span>
          </p>
          <Link
            to="/"
            className="text-secondary hover:text-white text-[16px] font-medium transition-colors"
          >
            ← Back to Dev Portfolio
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={`${styles.paddingX} pt-32 pb-16 max-w-7xl mx-auto`}>
        <h1 className={`${styles.heroHeadText} text-white`}>
          Handyman &amp; <span className="text-[#915eff]">Landscaper</span>
        </h1>
        <p className={`${styles.heroSubText} mt-4 text-white-100 max-w-3xl`}>
          When I'm not writing code, I'm building, fixing, and growing things.
          From electrical work to raised garden beds — if it needs doing, I figure it out.
        </p>
      </section>

      {/* Placeholder sections — build these out */}
      <section className={`${styles.padding} max-w-7xl mx-auto`}>
        <p className="text-secondary text-[18px]">Services, projects, and photos coming soon.</p>
      </section>
    </div>
  );
};

export default Handyman;
