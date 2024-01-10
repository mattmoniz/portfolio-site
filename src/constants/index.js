import {
  mobile,
  backend,
  creator,
  web,
  javascript,
  html,
  css,
  reactjs,
  redux,
  tailwind,
  nodejs,
  git,
  docker,
  carrent,
  jobit,
  tripguide,
  fastforward,
  launchacademy,
  monsterworldwide,
  citizens,
  storybook,
  modernReactSite,
  ecommerce,
  crowdFundingBlockChain,
  openAIArticleSummary,
} from "../assets";

export const navLinks = [
  {
    id: "about",
    title: "About",
  },
  {
    id: "work",
    title: "Work",
  },
  {
    id: "contact",
    title: "Contact",
  },
];

const services = [
  {
    title: "Web Developer",
    icon: web,
  },
  {
    title: "React Native Developer",
    icon: mobile,
  },
  {
    title: "Backend Developer",
    icon: backend,
  },
  {
    title: "Content Creator",
    icon: creator,
  },
];

const technologies = [
  {
    name: "HTML 5",
    icon: html,
  },
  {
    name: "CSS 3",
    icon: css,
  },
  {
    name: "JavaScript",
    icon: javascript,
  },
  {
    name: "React JS",
    icon: reactjs,
  },
  {
    name: "Redux Toolkit",
    icon: redux,
  },
  {
    name: "Tailwind",
    icon: tailwind,
  },
  {
    name: "Node JS",
    icon: nodejs,
  },
  {
    name: "git",
    icon: git,
  },
  {
    name: "docker",
    icon: docker,
  },
  {
    name: "storybook",
    icon: storybook,
  },
];

const experiences = [
  {
    title: "Front End Developer",
    company_name: "Fast Forward",
    icon: fastforward,
    iconBg: "#383E56",
    date: "Nov 2020 - Mar 2023",
    bullets: [
      "Built three large healthcare calculators apps used by over 1500 sales reps using React, CSS and Redux.",
      "Cut development time in half by building a component library Storybook and Material UI",
      "Supported a large enterprise website Boston-area hospital with over 300,000 monthly visitors. Worked with stakeholders to incorporate their needs and demo changes.",
      "Built over 20 different CI/CD pipelines for 7 sites using Azure DevOps. Pipelines kicked off visual regression testing and greatly improved release quality.",
      "Collaborating with cross-functional teams including designers,and other developers to create high-quality products.",
      "Implementing responsive design and ensuring cross-browser compatibility.",
    ],
  },
  {
    title: "Full Stack Developer",
    company_name: "Launch Academy",
    icon: launchacademy,
    iconBg: "#383E56",
    date: "March 2020 - June 2020",
    bullets: [
      "Participated in an intensive web development bootcamp practicing full-stack development.",
      "Built web apps using ReactJS and Utilized CSS/SCSS with Foundation for styling.",
      "Developed a Rails back-end with PostgreSQL database and serialized API endpoints.",
    ],
  },
  {
    title: "Sales Operations Analyst",
    company_name: "Monster Worldwide",
    icon: monsterworldwide,
    iconBg: "#E6DEDD",
    date: "Apr 2015 - Oct 2019",
    bullets: [
      "Cut Support requests by 70% by analyzing order data using Salesforce and VBA skills to point out bottlenecks in Salesforce adoption.",
      "Designed and executed end to end testing for recent Salesforce Lightning deployment.",
      "Worked on a cross-functional Agile SCRUM team to address impending issues or initiatives logged in JIRA.",
    ],
  },
  {
    title: "Business Analyst",
    company_name: "Citizens Financial Group",
    icon: citizens,
    iconBg: "#E6DEDD",
    date: "Jan 2007 - Oct 2014",
    bullets: [
      "Reduced processing time by 80%, after Access databases needed to monitor and report portfolio analytics monthly.",
      "Defined, researched, and resolved miscellaneous trade and asset issues with brokers and internal customers.",
    ],
  },
];

const testimonials = [
  {
    testimonial:
      "I thought it was impossible to make a website as beautiful as our product, but RickTesmin proved me wrong.",
    name: "Sara Lee",
    designation: "CFO",
    company: "Acme Co",
    image: "https://randomuser.me/api/portraits/women/4.jpg",
  },
  {
    testimonial:
      "I've never met a web developer who truly cares about their clients' success like Rick does.",
    name: "Chris Brown",
    designation: "COO",
    company: "DEF Corp",
    image: "https://randomuser.me/api/portraits/men/5.jpg",
  },
  {
    testimonial:
      "After Rick optimized our website, our traffic increased by 50%. We can't thank them enough!",
    name: "Lisa Wang",
    designation: "CTO",
    company: "456 Enterprises",
    image: "https://randomuser.me/api/portraits/women/6.jpg",
  },
];

const projects = [
  {
    name: "Modern React Landing Page",
    description: "Modern example of a single React Landing Page.",
    tags: [
      {
        name: "react",
        color: "blue-text-gradient",
      },
      {
        name: "tailwind",
        color: "pink-text-gradient",
      },
    ],
    image: modernReactSite,
    source_code_link: "https://github.com/mattmoniz/modern_react_website",
    project_url: "https://main.dy8ptiuetuxsx.amplifyapp.com/",
  },
  {
    name: "ecommerce site",
    description:
      "Modern Ecommerce site built using NextJS for the front end and I built a Content Management System using Sanity. Finally, I was able to implement payment functionality using Stripe's API.",
    tags: [
      {
        name: "NextJS",
        color: "blue-text-gradient",
      },
      {
        name: "Sanity CMS",
        color: "green-text-gradient",
      },
      {
        name: "Stripe",
        color: "pink-text-gradient",
      },
    ],
    image: ecommerce,
    source_code_link: "https://github.com/mattmoniz/nextjs-ecommerce-app",
    project_url: "https://ecommerce-app-mattmoniz.vercel.app/",
  },
  {
    name: "Blockchain Crowdfunding site",
    description:
      "Demo Blockchain crowd funding site which allows users to create ro donate to demo campaigns using fake cryptocurrency.",
    tags: [
      {
        name: "React",
        color: "blue-text-gradient",
      },
      {
        name: "thirdweb",
        color: "green-text-gradient",
      },
      {
        name: "Tailwind",
        color: "pink-text-gradient",
      },
    ],
    image: crowdFundingBlockChain,
    source_code_link: "https://github.com/mattmoniz/Crowdfunding-Blockchain",
    project_url: "https://mellifluous-centaur-e8704e.netlify.app/",
  },
  {
    name: "OpenAI Article Summarizer",
    description:
      "This page takes a URL to an lengthy article and summarizes it ",
    tags: [
      {
        name: "React",
        color: "blue-text-gradient",
      },
      {
        name: "OpenAI",
        color: "green-text-gradient",
      },
      {
        name: "Tailwind",
        color: "pink-text-gradient",
      },
    ],
    image: openAIArticleSummary,
    source_code_link: "https://github.com/mattmoniz/ai-reader",
    project_url: "https://lucky-marzipan-55ba96.netlify.app/",
  },
];

export { services, technologies, experiences, testimonials, projects };
