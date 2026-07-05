export type ScreenKey =
  | "home"
  | "profile"
  | "cv"
  | "website"
  | "publications"
  | "files"
  | "billing"
  | "settings";

type ScreenAction = {
  label: string;
  variant?: "primary" | "secondary";
};

type ScreenCard = {
  title: string;
  meta: string;
  body: string;
};

export type ScreenDefinition = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: ScreenAction;
  secondaryAction?: ScreenAction;
  cards: ScreenCard[];
};

export const screens: Record<ScreenKey, ScreenDefinition> = {
  home: {
    eyebrow: "Academic Profile OS",
    title: "Create your CV and website from one academic profile.",
    description:
      "This Stage 1 shell shows the future product structure without changing the current PHP production app. Backend, auth, PDF rendering, billing, and data migration come later.",
    primaryAction: { label: "Start Building" },
    secondaryAction: { label: "View Templates", variant: "secondary" },
    cards: [
      {
        title: "Profile completeness",
        meta: "Foundation",
        body: "The central academic profile will power CV PDFs, websites, publications, bios, and future institution tools."
      },
      {
        title: "Recent outputs",
        meta: "Files",
        body: "Generated PDFs and public website assets will become first-class file records in R2."
      },
      {
        title: "Next best action",
        meta: "Guidance",
        body: "Each screen should have one clear primary action and compact helper text for non-technical users."
      }
    ]
  },
  profile: {
    eyebrow: "Structured Data",
    title: "Academic Profile",
    description:
      "The profile editor will collect personal info, education, experience, research interests, publications, projects, awards, memberships, languages, and references.",
    primaryAction: { label: "Save Profile" },
    cards: [
      {
        title: "Basics",
        meta: "Required",
        body: "Name, title, affiliation, public links, and contact visibility."
      },
      {
        title: "Academic sections",
        meta: "Reusable",
        body: "Structured sections replace duplicate CV-only data entry."
      },
      {
        title: "Completeness score",
        meta: "Activation",
        body: "The right panel will surface profile readiness and missing essentials."
      }
    ]
  },
  cv: {
    eyebrow: "Document Engine",
    title: "Build CV",
    description:
      "Users will select a template, choose included sections, and enqueue a PDF render job handled by an isolated Tectonic worker.",
    primaryAction: { label: "Generate PDF" },
    secondaryAction: { label: "Preview Template", variant: "secondary" },
    cards: [
      {
        title: "Template registry",
        meta: "Controlled",
        body: "Current templates are ported into versioned template packages instead of raw user LaTeX."
      },
      {
        title: "Render status",
        meta: "Queued",
        body: "PDF jobs move through Waiting, Creating, Ready, or Failed."
      },
      {
        title: "Safe exports",
        meta: "R2",
        body: "Final PDFs are stored as file assets and served through signed URLs where private."
      }
    ]
  },
  website: {
    eyebrow: "Public Identity",
    title: "Academic Website",
    description:
      "The website builder will reuse the same profile data, preserve draft/published state, and keep /u/{slug} compatibility before subdomains launch.",
    primaryAction: { label: "Publish Website" },
    secondaryAction: { label: "Preview Draft", variant: "secondary" },
    cards: [
      {
        title: "Template selector",
        meta: "Website",
        body: "Classic, modern, and future website templates share the structured profile source."
      },
      {
        title: "Visibility controls",
        meta: "Privacy",
        body: "Users can hide sections and private fields before publishing."
      },
      {
        title: "Contact form",
        meta: "Protected",
        body: "Future implementation should add rate limiting and Turnstile before public launch."
      }
    ]
  },
  publications: {
    eyebrow: "Research Output",
    title: "Publications",
    description:
      "Publications become a reusable library for CVs, academic websites, featured work, and citation views.",
    primaryAction: { label: "Add Publication" },
    cards: [
      {
        title: "Manual entry",
        meta: "MVP",
        body: "Title, authors, venue, year, DOI, URL, type, and featured status."
      },
      {
        title: "Imports",
        meta: "Later",
        body: "ORCID, Scholar, DOI lookup, and AI CV extraction return after the core profile is stable."
      },
      {
        title: "Deduplication",
        meta: "Migration",
        body: "Migration should dedupe by DOI first, then normalized title and year."
      }
    ]
  },
  files: {
    eyebrow: "Outputs",
    title: "Files / PDFs",
    description:
      "Generated PDFs, uploaded CVs, public website assets, and future thumbnails should be visible and manageable.",
    primaryAction: { label: "View Files" },
    cards: [
      {
        title: "Generated PDFs",
        meta: "Private",
        body: "Most files use signed URLs and stay private unless the user explicitly publishes them."
      },
      {
        title: "Website assets",
        meta: "Public",
        body: "Profile images, OG images, and public downloads live in controlled R2 buckets."
      },
      {
        title: "Storage usage",
        meta: "Billing",
        body: "Storage can later connect to plan limits and credit usage."
      }
    ]
  },
  billing: {
    eyebrow: "Monetization",
    title: "Billing",
    description:
      "Plans control access; credits control selected usage-heavy actions. The rewrite must preserve current balances and payment history.",
    primaryAction: { label: "Upgrade Plan" },
    cards: [
      {
        title: "Credit wallet",
        meta: "Ledger",
        body: "Every grant, purchase, spend, and refund must reconcile against the workspace balance."
      },
      {
        title: "Subscription",
        meta: "Access",
        body: "Plans unlock templates, websites, storage, branding, and future domains."
      },
      {
        title: "Provider decision",
        meta: "Open",
        body: "PayHere continuity must be decided before checkout cutover."
      }
    ]
  },
  settings: {
    eyebrow: "Account",
    title: "Settings",
    description:
      "Settings will include account, workspace, privacy, notifications, website domain, and data export/delete paths.",
    primaryAction: { label: "Save Settings" },
    cards: [
      {
        title: "Privacy",
        meta: "Profile",
        body: "Visibility choices should flow into CVs and websites consistently."
      },
      {
        title: "Workspace",
        meta: "Future",
        body: "The first version can be individual-only while keeping workspace membership ready."
      },
      {
        title: "Notifications",
        meta: "Email",
        body: "Resend will handle future transactional messages and render-complete notifications."
      }
    ]
  }
};
