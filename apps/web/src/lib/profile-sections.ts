export type ProfileFieldType = "text" | "email" | "url" | "textarea" | "select" | "date";

export type ProfileFieldDefinition = {
  name: string;
  label: string;
  type: ProfileFieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
};

export type ProfileSectionDefinition = {
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  addLabel: string;
  summaryField: string;
  sectionOrder: number;
  defaultVisible: boolean;
  fields: ProfileFieldDefinition[];
};

export const publicationTypeOptions = [
  "Journal Article",
  "Conference Paper",
  "Book",
  "Book Chapter",
  "White Paper",
  "Technical Paper",
  "Preprint",
  "Thesis",
  "Patent",
  "Report",
  "Dataset",
  "Other"
];

export const publicationStatusOptions = [
  "Published",
  "Accepted",
  "In Press",
  "Under Review",
  "Submitted",
  "Preprint",
  "Draft"
];

export const publicationFieldExamples: Record<string, string> = {
  title: "Optical response of layered Cu2O/TiO2 films for low-light sensing",
  authors: "A. Senanayake, R. Perera, M. Fernando",
  year: "2021",
  publication_type: "Journal Article",
  venue: "Journal of Applied Materials Research",
  volume_issue_pages: "Vol. 18, Issue 2, pp. 115-126",
  doi: "10.1234/jamr.2021.0018",
  url: "https://doi.org/10.1234/jamr.2021.0018",
  status: "Published"
};

export const defaultVisibleSectionKeys = [
  "education",
  "languages",
  "experience",
  "teaching",
  "awards",
  "memberships",
  "grants",
  "publications",
  "references",
  "declaration"
];

export const personalFields: ProfileFieldDefinition[] = [
  { name: "displayName", label: "Full Name", type: "text", required: true },
  { name: "headline", label: "Academic Title", type: "text", placeholder: "Senior Lecturer, Researcher, PhD Candidate" },
  { name: "affiliation", label: "University / Institution", type: "text" },
  { name: "location", label: "Location", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "websiteUrl", label: "Website", type: "url" },
  { name: "googleScholarUrl", label: "Google Scholar", type: "url" },
  { name: "orcidUrl", label: "ORCID", type: "url" },
  { name: "linkedinUrl", label: "LinkedIn", type: "url" },
  { name: "bio", label: "Short Bio", type: "textarea" },
];

export const profileSections = [
  {
    key: "education",
    title: "Education",
    shortTitle: "Education",
    description: "Degrees, school qualifications, diplomas, certificates, and academic training.",
    addLabel: "Add education",
    summaryField: "degree",
    sectionOrder: 20,
    defaultVisible: true,
    fields: [
      { name: "degree", label: "Degree / Qualification", type: "text", required: true },
      { name: "qualification", label: "Qualification", type: "text" },
      { name: "education_level", label: "Education Level", type: "text", placeholder: "Undergraduate, Graduate, School, Diploma" },
      { name: "institution", label: "Institution", type: "text", required: true },
      { name: "location", label: "Location", type: "text" },
      { name: "field_of_study", label: "Field of Study", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text", placeholder: "Present" },
      { name: "thesis", label: "Thesis", type: "text" },
      { name: "supervisor", label: "Supervisor", type: "text" },
      { name: "gpa", label: "GPA / Result", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "details", label: "Additional Details", type: "textarea" }
    ]
  },
  {
    key: "languages",
    title: "Languages",
    shortTitle: "Languages",
    description: "Languages and proficiency levels.",
    addLabel: "Add language",
    summaryField: "language",
    sectionOrder: 30,
    defaultVisible: true,
    fields: [
      { name: "language", label: "Language", type: "text", required: true },
      { name: "proficiency", label: "Proficiency", type: "select", options: ["Basic", "Intermediate", "Proficient", "Fluent", "Native / Bilingual"] }
    ]
  },
  {
    key: "experience",
    title: "Work Experience",
    shortTitle: "Work Experience",
    description: "Employment, professional roles, and academic work experience.",
    addLabel: "Add experience",
    summaryField: "position",
    sectionOrder: 40,
    defaultVisible: true,
    fields: [
      { name: "position", label: "Position", type: "text", required: true },
      { name: "organization", label: "Organization", type: "text", required: true },
      { name: "department", label: "Department", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text", placeholder: "Present" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "teaching",
    title: "Teaching",
    shortTitle: "Teaching",
    description: "Courses, modules, lectures, workshops, and teaching roles.",
    addLabel: "Add teaching",
    summaryField: "course",
    sectionOrder: 50,
    defaultVisible: true,
    fields: [
      { name: "course", label: "Course / Activity", type: "text", required: true },
      { name: "code", label: "Course Code", type: "text" },
      { name: "level", label: "Level", type: "text" },
      { name: "institution", label: "Institution", type: "text" },
      { name: "role", label: "Role", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "awards",
    title: "Awards",
    shortTitle: "Awards",
    description: "Awards, honors, scholarships, and recognitions.",
    addLabel: "Add award",
    summaryField: "title",
    sectionOrder: 60,
    defaultVisible: true,
    fields: [
      { name: "title", label: "Award", type: "text", required: true },
      { name: "organization", label: "Organization", type: "text" },
      { name: "issuer", label: "Issuer", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "level", label: "Level", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "details", label: "Additional Details", type: "textarea" }
    ]
  },
  {
    key: "memberships",
    title: "Memberships",
    shortTitle: "Memberships",
    description: "Professional memberships and academic affiliations.",
    addLabel: "Add membership",
    summaryField: "organization",
    sectionOrder: 70,
    defaultVisible: true,
    fields: [
      { name: "organization", label: "Organization", type: "text", required: true },
      { name: "role", label: "Role / Membership Type", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" }
    ]
  },
  {
    key: "grants",
    title: "Grants",
    shortTitle: "Grants",
    description: "Funded grants, fellowships, and sponsored projects.",
    addLabel: "Add grant",
    summaryField: "title",
    sectionOrder: 80,
    defaultVisible: true,
    fields: [
      { name: "title", label: "Grant Title", type: "text", required: true },
      { name: "agency", label: "Agency / Funder", type: "text" },
      { name: "grant_number", label: "Grant Number", type: "text" },
      { name: "role", label: "Role", type: "text" },
      { name: "amount", label: "Amount", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "status", label: "Status", type: "text" },
      { name: "collaborators", label: "Collaborators", type: "textarea" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "publications",
    title: "Publications",
    shortTitle: "Publications",
    description: "Journal articles, books, conference papers, and selected research outputs.",
    addLabel: "Add publication",
    summaryField: "title",
    sectionOrder: 90,
    defaultVisible: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "authors", label: "Authors", type: "textarea" },
      { name: "year", label: "Year", type: "select", options: publicationYearOptions() },
      { name: "publication_type", label: "Publication Type", type: "select", options: publicationTypeOptions },
      { name: "venue", label: "Journal / Conference / Book", type: "text", placeholder: publicationFieldExamples.venue },
      { name: "volume_issue_pages", label: "Volume / Issue / Pages", type: "text", placeholder: publicationFieldExamples.volume_issue_pages },
      { name: "doi", label: "DOI", type: "text" },
      { name: "url", label: "URL", type: "url" },
      { name: "status", label: "Status", type: "select", options: publicationStatusOptions }
    ]
  },
  {
    key: "references",
    title: "References",
    shortTitle: "References",
    description: "Reference contacts or a note such as available on request.",
    addLabel: "Add reference",
    summaryField: "name",
    sectionOrder: 100,
    defaultVisible: true,
    fields: [
      { name: "name", label: "Name / Note", type: "text", required: true },
      { name: "title", label: "Title", type: "text" },
      { name: "institution", label: "Institution", type: "text" },
      { name: "affiliation", label: "Affiliation", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "relationship", label: "Relationship", type: "text" }
    ]
  },
  {
    key: "declaration",
    title: "Declaration",
    shortTitle: "Declaration",
    description: "A formal statement and signature line for the final CV.",
    addLabel: "Add declaration",
    summaryField: "statement",
    sectionOrder: 110,
    defaultVisible: true,
    fields: [
      {
        name: "statement",
        label: "Declaration Statement",
        type: "textarea",
        required: true,
        defaultValue: "I hereby declare that the information provided above is true and accurate to the best of my knowledge."
      },
      { name: "declaration_date", label: "Date", type: "date" },
      { name: "signature_mode", label: "Signature Type", type: "select", defaultValue: "Manual Signature", options: ["Manual Signature", "Electronic Signature"] },
      { name: "signature_name", label: "Signatory Name", type: "text" }
    ]
  },
  {
    key: "research_interests",
    title: "Research Interests",
    shortTitle: "Research",
    description: "Main research areas visitors and CV readers should see first.",
    addLabel: "Add interest",
    summaryField: "interest",
    sectionOrder: 120,
    defaultVisible: false,
    fields: [
      { name: "interest", label: "Research Interest", type: "text", required: true },
      { name: "area", label: "Research Area", type: "text" },
      { name: "details", label: "Details", type: "textarea" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "academic_appointments",
    title: "Academic Appointments",
    shortTitle: "Appointments",
    description: "Faculty appointments and formal academic positions.",
    addLabel: "Add appointment",
    summaryField: "position",
    sectionOrder: 130,
    defaultVisible: false,
    fields: [
      { name: "position", label: "Position", type: "text", required: true },
      { name: "institution", label: "Institution", type: "text" },
      { name: "department", label: "Department", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "research_experience",
    title: "Research Experience",
    shortTitle: "Research Exp.",
    description: "Research positions, projects, supervisors, and lab roles.",
    addLabel: "Add research role",
    summaryField: "position",
    sectionOrder: 140,
    defaultVisible: false,
    fields: [
      { name: "position", label: "Position", type: "text", required: true },
      { name: "institution", label: "Institution", type: "text" },
      { name: "project", label: "Project", type: "text" },
      { name: "supervisor", label: "Supervisor", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "projects",
    title: "Projects",
    shortTitle: "Projects",
    description: "Research projects, collaborations, and applied work.",
    addLabel: "Add project",
    summaryField: "title",
    sectionOrder: 150,
    defaultVisible: false,
    fields: [
      { name: "title", label: "Project Title", type: "text", required: true },
      { name: "role", label: "Role", type: "text" },
      { name: "organization", label: "Organization", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "collaborators", label: "Collaborators", type: "textarea" },
      { name: "outputs", label: "Outputs", type: "textarea" }
    ]
  },
  {
    key: "conferences",
    title: "Conferences",
    shortTitle: "Conferences",
    description: "Conference talks, presentations, invited lectures, and posters.",
    addLabel: "Add conference",
    summaryField: "title",
    sectionOrder: 160,
    defaultVisible: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "conference", label: "Conference", type: "text" },
      { name: "event", label: "Event", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "date", label: "Date", type: "date" },
      { name: "year", label: "Year", type: "text" },
      { name: "presentation_type", label: "Presentation Type", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "supervision",
    title: "Supervision",
    shortTitle: "Supervision",
    description: "Student supervision and mentoring activities.",
    addLabel: "Add supervision",
    summaryField: "student_name",
    sectionOrder: 170,
    defaultVisible: false,
    fields: [
      { name: "student_name", label: "Student / Group", type: "text", required: true },
      { name: "degree", label: "Degree", type: "text" },
      { name: "institution", label: "Institution", type: "text" },
      { name: "role", label: "Role", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "status", label: "Status", type: "text" },
      { name: "topic", label: "Topic", type: "textarea" }
    ]
  },
  {
    key: "patents",
    title: "Patents",
    shortTitle: "Patents",
    description: "Patents, patent applications, and intellectual property.",
    addLabel: "Add patent",
    summaryField: "title",
    sectionOrder: 180,
    defaultVisible: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "inventors", label: "Inventors", type: "textarea" },
      { name: "patent_number", label: "Patent Number", type: "text" },
      { name: "jurisdiction", label: "Jurisdiction", type: "text" },
      { name: "status", label: "Status", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "url", label: "URL", type: "url" }
    ]
  },
  {
    key: "invited_talks",
    title: "Invited Talks",
    shortTitle: "Invited Talks",
    description: "Keynotes, invited lectures, seminars, and talks.",
    addLabel: "Add talk",
    summaryField: "title",
    sectionOrder: 190,
    defaultVisible: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "event", label: "Event", type: "text" },
      { name: "institution", label: "Institution", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "date", label: "Date", type: "date" },
      { name: "year", label: "Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "academic_service",
    title: "Academic Service",
    shortTitle: "Service",
    description: "Committees, service roles, and institutional contributions.",
    addLabel: "Add service",
    summaryField: "role",
    sectionOrder: 200,
    defaultVisible: false,
    fields: [
      { name: "role", label: "Role", type: "text", required: true },
      { name: "committee", label: "Committee", type: "text" },
      { name: "institution", label: "Institution", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "editorial",
    title: "Editorial and Reviewing",
    shortTitle: "Editorial",
    description: "Editorial boards, journal reviewing, and reviewer roles.",
    addLabel: "Add editorial role",
    summaryField: "role",
    sectionOrder: 210,
    defaultVisible: false,
    fields: [
      { name: "role", label: "Role", type: "text", required: true },
      { name: "journal", label: "Journal", type: "text" },
      { name: "publisher", label: "Publisher", type: "text" },
      { name: "year_start", label: "Start Year", type: "text" },
      { name: "year_end", label: "End Year", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "certifications",
    title: "Certifications",
    shortTitle: "Certifications",
    description: "Certificates, licenses, and credentials.",
    addLabel: "Add certification",
    summaryField: "title",
    sectionOrder: 220,
    defaultVisible: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "issuer", label: "Issuer", type: "text" },
      { name: "organization", label: "Organization", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "credential_id", label: "Credential ID", type: "text" },
      { name: "description", label: "Description", type: "textarea" }
    ]
  },
  {
    key: "skills",
    title: "Skills",
    shortTitle: "Skills",
    description: "Technical skills, research methods, tools, and competencies.",
    addLabel: "Add skills",
    summaryField: "category",
    sectionOrder: 230,
    defaultVisible: false,
    fields: [
      { name: "category", label: "Category", type: "text", required: true },
      { name: "skills", label: "Skills", type: "textarea", required: true }
    ]
  }
] as const satisfies readonly ProfileSectionDefinition[];

export function publicationYearOptions() {
  const current = new Date().getFullYear() + 2;
  return Array.from({ length: current - 1949 }, (_, index) => String(current - index));
}

export type ProfileSectionKey = (typeof profileSections)[number]["key"];

export function sectionDefinitionByKey(key: string) {
  return profileSections.find((section) => section.key === key);
}

export function linesToItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function itemsToLines(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.filter((item): item is string => typeof item === "string").join("\n");
}

export function entrySummary(sectionKey: string, data: Record<string, unknown>) {
  const definition = sectionDefinitionByKey(sectionKey);
  const preferred = definition?.summaryField ? data[definition.summaryField] : "";

  if (typeof preferred === "string" && preferred.trim()) {
    return preferred.trim();
  }

  for (const field of definition?.fields ?? []) {
    const value = data[field.name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "New entry";
}
