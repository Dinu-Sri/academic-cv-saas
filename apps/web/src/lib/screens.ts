export type ScreenKey = "profile" | "cv" | "website" | "publications" | "billing" | "settings";

type ScreenAction = {
  label: string;
};

export type ScreenDefinition = {
  title: string;
  description: string;
  primaryAction: ScreenAction;
  focusTitle: string;
  focusText: string;
  simpleSteps: string[];
};

export const screens: Record<ScreenKey, ScreenDefinition> = {
  profile: {
    title: "Build CV",
    description: "Add your main academic details once. We use this information for your CV and website.",
    primaryAction: { label: "Edit Profile" },
    focusTitle: "Start with your basic details",
    focusText: "Name, title, university, research area, contact links, education, and experience.",
    simpleSteps: ["Add personal details", "Add education and work history"]
  },
  cv: {
    title: "Manage CVs",
    description: "Create a professional academic CV from your saved profile.",
    primaryAction: { label: "Create CV" },
    focusTitle: "Choose a template",
    focusText: "Pick a CV style, review the information, then generate the PDF.",
    simpleSteps: ["Choose template", "Generate PDF"]
  },
  website: {
    title: "Academic Website",
    description: "Build a private draft site from your academic profile, then preview before any public publish.",
    primaryAction: { label: "Open Website" },
    focusTitle: "Claim your website address",
    focusText: "Choose a username, reuse your profile data, control privacy, and preview the Scholar Pages draft.",
    simpleSteps: ["Claim username", "Complete readiness", "Preview draft"]
  },
  publications: {
    title: "Publications",
    description: "Keep your papers and research outputs in one place.",
    primaryAction: { label: "Add Publication" },
    focusTitle: "Add your research work",
    focusText: "Add the title, authors, year, journal or conference, and link if available.",
    simpleSteps: ["Add publication details", "Mark important work as featured"]
  },
  billing: {
    title: "Billing",
    description: "Build free. Unlock PDF downloads or go annual for a full professional setup.",
    primaryAction: { label: "View plans" },
    focusTitle: "Choose Free, PDF Pass, or Scholar Annual",
    focusText: "Preview everything free. Pay $5 for 30 days of downloads, or go annual for branded website and domain.",
    simpleSteps: ["Review your plan", "Buy with in-page checkout"]
  },
  settings: {
    title: "Settings",
    description: "Control your account, privacy, and notification settings.",
    primaryAction: { label: "Open Settings" },
    focusTitle: "Keep your account up to date",
    focusText: "Update login, privacy, and public profile preferences.",
    simpleSteps: ["Check privacy", "Save changes"]
  }
};
