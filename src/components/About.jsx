import React from "react";
import { Tilt } from "react-tilt";
import { motion } from "framer-motion";
import { styles } from "../styles";
import { services } from "../constants";
import { fadeIn, textVariant } from "../utils/motion";
import { SectionWrapper } from "../hoc";

const About = () => {
  return (
      <div
        className="mt-20 text-secondary text-[17px] max-w-3xl leading-[30px] ml-10"
      >
        I'm a skilled software developer with experience in Javascript and
        experience in libraries like React and frameworks like Gatsby. I also have experience
        building styleguides and styling CSS with Bootstrap and Tailwind. I'm a
        quick learner, and love collaborating with teammates and clients to create efficient
        simple solutions to solve realworld problems.
      </div>
  );
};

export default SectionWrapper(About, "about");
