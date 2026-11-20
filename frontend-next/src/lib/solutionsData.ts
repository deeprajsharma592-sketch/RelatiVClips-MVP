export interface SolutionItem {
  id: string;
  title: string;
  description: string;
  column: 1 | 2 | 3;
  archetype: string;
  href: string;
}

export const SOLUTIONS_LIST: SolutionItem[] = [
  // Column 1
  {
    id: "creators",
    title: "Creators",
    description: "Fastest way to gain your next 1 million views without burnout",
    column: 1,
    archetype: "streamer",
    href: "/dashboard?archetype=streamer",
  },
  {
    id: "podcasters",
    title: "Podcasters",
    description: "Get your next 1 million views in weeks via consistent posting",
    column: 1,
    archetype: "podcast",
    href: "/dashboard?archetype=podcast",
  },
  {
    id: "advertisers",
    title: "Advertisers",
    description: "Create high-performing ad creatives at scale",
    column: 1,
    archetype: "advertisers",
    href: "/dashboard?archetype=advertisers",
  },
  {
    id: "real-estate",
    title: "Real estate",
    description: "Get more leads through shorts to become the top-selling realtor",
    column: 1,
    archetype: "realestate",
    href: "/dashboard?archetype=realestate",
  },

  // Column 2
  {
    id: "media-entertainment",
    title: "Media & entertainment",
    description: "Streamline video creation workflow & reach 10x more audiences",
    column: 2,
    archetype: "entertainment",
    href: "/dashboard?archetype=entertainment",
  },
  {
    id: "agencies",
    title: "Agencies",
    description: "Scale your business and save $2,700 monthly on editing cost",
    column: 2,
    archetype: "agencies",
    href: "/dashboard?archetype=agencies",
  },
  {
    id: "church",
    title: "Church",
    description: "Evangelize digitally to reach more people & get more donations",
    column: 2,
    archetype: "church",
    href: "/dashboard?archetype=church",
  },

  // Column 3
  {
    id: "marketers",
    title: "Marketers",
    description: "Make every marketer a pro video editor",
    column: 3,
    archetype: "marketers",
    href: "/dashboard?archetype=marketers",
  },
  {
    id: "livestreamers",
    title: "Livestreamers",
    description: "Drive more traffic back to your livestreams through shorts",
    column: 3,
    archetype: "streamer",
    href: "/dashboard?archetype=streamer",
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    description: "Sell more products & increase exposure with viral shorts",
    column: 3,
    archetype: "ecommerce",
    href: "/dashboard?archetype=ecommerce",
  },
];

export const SOLUTIONS_COLUMNS = [
  SOLUTIONS_LIST.filter((s) => s.column === 1),
  SOLUTIONS_LIST.filter((s) => s.column === 2),
  SOLUTIONS_LIST.filter((s) => s.column === 3),
];
