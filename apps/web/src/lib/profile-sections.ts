export type ProfileFieldType = "text" | "email" | "url" | "textarea" | "select" | "date";

export type ProfileFieldDefinition = {
  name: string;
  label: string;
  type: ProfileFieldType;
  required?: boolean;
  placeholder?: string;
  /** Short illustrative example shown when “Show me how to fill” is on. */
  example?: string;
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
  "bio",
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

export const personalDetailFields: ProfileFieldDefinition[] = [
  {
    name: "displayName",
    label: "Full Name",
    type: "text",
    required: true,
    example: "Dr. Asha Perera"
  },
  {
    name: "headline",
    label: "Academic Title",
    type: "text",
    placeholder: "Senior Lecturer, Researcher, PhD Candidate",
    example: "Senior Lecturer in Materials Science"
  },
  {
    name: "affiliation",
    label: "University / Institution",
    type: "text",
    example: "University of Colombo"
  },
  {
    name: "location",
    label: "Location",
    type: "text",
    example: "Colombo, Sri Lanka"
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    example: "asha.perera@university.edu"
  },
  {
    name: "websiteUrl",
    label: "Website",
    type: "url",
    example: "https://ashaperera.cvscholar.com"
  },
  {
    name: "googleScholarUrl",
    label: "Google Scholar",
    type: "url",
    example: "https://scholar.google.com/citations?user=…"
  },
  {
    name: "orcidUrl",
    label: "ORCID",
    type: "url",
    example: "https://orcid.org/0000-0002-1825-0097"
  },
  {
    name: "linkedinUrl",
    label: "LinkedIn",
    type: "url",
    example: "https://www.linkedin.com/in/ashaperera"
  }
];

export const bioFields: ProfileFieldDefinition[] = [
  {
    name: "bio",
    label: "Summary",
    type: "textarea",
    placeholder: "Summarize your academic background, research focus, and current work.",
    example:
      "Materials scientist working on thin-film sensors. I study low-light optical response in oxide heterostructures and supervise postgraduate research on sustainable electronic materials."
  }
];

/** PDF/CV heading is "Summary" (not "Short Bio") — standard academic CV practice. */
export const bioSectionDefinition = {
  key: "bio",
  title: "Summary",
  shortTitle: "Summary",
  description: "A concise academic introduction used by your CV and website.",
  addLabel: "Add summary",
  summaryField: "bio",
  sectionOrder: 10,
  defaultVisible: true,
  fields: bioFields
} as const satisfies ProfileSectionDefinition;

// Keep one canonical personal-field catalog for imports, AI patches, and CV rendering.
export const personalFields: ProfileFieldDefinition[] = [...personalDetailFields, ...bioFields];

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
      { name: "degree", label: "Degree / Qualification", type: "text", required: true, example: "PhD in Materials Science" },
      { name: "qualification", label: "Qualification", type: "text", example: "Doctor of Philosophy" },
      {
        name: "education_level",
        label: "Education Level",
        type: "text",
        placeholder: "Undergraduate, Graduate, School, Diploma",
        example: "Graduate"
      },
      { name: "institution", label: "Institution", type: "text", required: true, example: "University of Cambridge" },
      { name: "location", label: "Location", type: "text", example: "Cambridge, UK" },
      { name: "field_of_study", label: "Field of Study", type: "text", example: "Materials Science & Engineering" },
      { name: "year_start", label: "Start Year", type: "text", example: "2016" },
      { name: "year_end", label: "End Year", type: "text", placeholder: "Present", example: "2020" },
      { name: "thesis", label: "Thesis", type: "text", example: "Oxide heterostructures for low-light optical sensing" },
      { name: "supervisor", label: "Supervisor", type: "text", example: "Prof. Jane Smith" },
      { name: "gpa", label: "GPA / Result", type: "text", example: "First Class / 3.9 GPA" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        example: "Doctoral research on thin-film deposition and optical characterization of Cu2O/TiO2 stacks."
      },
      { name: "details", label: "Additional Details", type: "textarea", example: "Scholarship: Commonwealth Scholarship" }
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
      { name: "language", label: "Language", type: "text", required: true, example: "English" },
      {
        name: "proficiency",
        label: "Proficiency",
        type: "select",
        options: ["Basic", "Intermediate", "Proficient", "Fluent", "Native / Bilingual"],
        example: "Fluent"
      }
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
      { name: "position", label: "Position", type: "text", required: true, example: "Senior Lecturer" },
      { name: "organization", label: "Organization", type: "text", required: true, example: "University of Colombo" },
      { name: "department", label: "Department", type: "text", example: "Department of Physics" },
      { name: "location", label: "Location", type: "text", example: "Colombo, Sri Lanka" },
      { name: "year_start", label: "Start Year", type: "text", example: "2021" },
      { name: "year_end", label: "End Year", type: "text", placeholder: "Present", example: "Present" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        example: "Teach undergraduate materials science; lead a lab group on thin-film sensors; serve on curriculum committee."
      }
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
      { name: "course", label: "Course / Activity", type: "text", required: true, example: "Introduction to Materials Science" },
      { name: "code", label: "Course Code", type: "text", example: "PHY2201" },
      { name: "level", label: "Level", type: "text", example: "Undergraduate (Year 2)" },
      { name: "institution", label: "Institution", type: "text", example: "University of Colombo" },
      { name: "role", label: "Role", type: "text", example: "Course coordinator / Lecturer" },
      { name: "year_start", label: "Start Year", type: "text", example: "2022" },
      { name: "year_end", label: "End Year", type: "text", example: "Present" },
      { name: "year", label: "Year", type: "text", example: "2023" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        example: "12-week module; 80 students; designed labs on XRD sample prep and optical characterization."
      }
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
      { name: "title", label: "Award", type: "text", required: true, example: "Best Young Researcher Award" },
      { name: "organization", label: "Organization", type: "text", example: "National Science Foundation" },
      { name: "issuer", label: "Issuer", type: "text", example: "NSF Sri Lanka" },
      { name: "year", label: "Year", type: "text", example: "2023" },
      { name: "level", label: "Level", type: "text", example: "National" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        example: "Awarded for contributions to low-light optical sensing materials."
      },
      { name: "details", label: "Additional Details", type: "textarea", example: "Cash prize and research grant component." }
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
      { name: "organization", label: "Organization", type: "text", required: true, example: "IEEE" },
      { name: "role", label: "Role / Membership Type", type: "text", example: "Member / Senior Member" },
      { name: "year_start", label: "Start Year", type: "text", example: "2019" },
      { name: "year_end", label: "End Year", type: "text", example: "Present" }
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
      {
        name: "title",
        label: "Grant Title",
        type: "text",
        required: true,
        example: "Low-light optical sensors based on oxide heterostructures"
      },
      { name: "agency", label: "Agency / Funder", type: "text", example: "National Research Council" },
      { name: "grant_number", label: "Grant Number", type: "text", example: "NRC-22-045" },
      { name: "role", label: "Role", type: "text", example: "Principal Investigator" },
      { name: "amount", label: "Amount", type: "text", example: "LKR 2,500,000" },
      { name: "year_start", label: "Start Year", type: "text", example: "2022" },
      { name: "year_end", label: "End Year", type: "text", example: "2024" },
      { name: "year", label: "Year", type: "text", example: "2022" },
      { name: "status", label: "Status", type: "text", example: "Active / Completed" },
      {
        name: "collaborators",
        label: "Collaborators",
        type: "textarea",
        example: "Co-I: Dr. R. Silva (University of Peradeniya)"
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        example: "Competitive research grant supporting equipment and two graduate students."
      }
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
      {
        name: "title",
        label: "Title",
        type: "text",
        required: true,
        example: publicationFieldExamples.title
      },
      { name: "authors", label: "Authors", type: "textarea", example: publicationFieldExamples.authors },
      {
        name: "year",
        label: "Year",
        type: "select",
        options: publicationYearOptions(),
        example: publicationFieldExamples.year
      },
      {
        name: "publication_type",
        label: "Publication Type",
        type: "select",
        options: publicationTypeOptions,
        example: publicationFieldExamples.publication_type
      },
      {
        name: "venue",
        label: "Journal / Conference / Book",
        type: "text",
        placeholder: publicationFieldExamples.venue,
        example: publicationFieldExamples.venue
      },
      {
        name: "volume_issue_pages",
        label: "Volume / Issue / Pages",
        type: "text",
        placeholder: publicationFieldExamples.volume_issue_pages,
        example: publicationFieldExamples.volume_issue_pages
      },
      { name: "doi", label: "DOI", type: "text", example: publicationFieldExamples.doi },
      { name: "url", label: "URL", type: "url", example: publicationFieldExamples.url },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: publicationStatusOptions,
        example: publicationFieldExamples.status
      }
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
      {
        name: "name",
        label: "Name / Note",
        type: "text",
        required: true,
        example: "Prof. Jane Smith — or “Available upon request”"
      },
      { name: "title", label: "Title", type: "text", example: "Professor of Materials Science" },
      { name: "institution", label: "Institution", type: "text", example: "University of Cambridge" },
      { name: "affiliation", label: "Affiliation", type: "text", example: "Department of Materials" },
      { name: "email", label: "Email", type: "email", example: "j.smith@cam.ac.uk" },
      { name: "phone", label: "Phone", type: "text", example: "+44 …" },
      { name: "relationship", label: "Relationship", type: "text", example: "PhD supervisor" }
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

// Bio is stored on AcademicProfile so websites, imports, and AI patches share one
// canonical value. The editor still treats it as an orderable CV section.
export const editorProfileSections = [bioSectionDefinition, ...profileSections] as const satisfies readonly ProfileSectionDefinition[];

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
