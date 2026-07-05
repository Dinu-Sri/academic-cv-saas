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
    title: "Academic Profile",
    description: "Add your main academic details once. We use this information for your CV and website.",
    primaryAction: { label: "Edit Profile" },
    focusTitle: "Start with your basic details",
    focusText: "Name, title, university, research area, contact links, education, and experience.",
    simpleSteps: ["Add personal details", "Add education and work history"]
  },
  cv: {
    title: "Build CV",
    description: "Create a professional academic CV from your saved profile.",
    primaryAction: { label: "Create CV" },
    focusTitle: "Choose a template",
    focusText: "Pick a CV style, review the information, then generate the PDF.",
    simpleSteps: ["Choose template", "Generate PDF"]
  },
  website: {
    title: "Academic Website",
    description: "Publish a simple personal academic website using your profile information.",
    primaryAction: { label: "Edit Website" },
    focusTitle: "Prepare your public page",
    focusText: "Choose what to show, preview it, then publish when ready.",
    simpleSteps: ["Review public information", "Publish website"]
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
    description: "Manage your plan, credits, invoices, and payments.",
    primaryAction: { label: "View Billing" },
    focusTitle: "Check your current plan",
    focusText: "See your plan, available credits, and payment history.",
    simpleSteps: ["Review plan", "Buy credits or upgrade"]
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
