import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

/** Bump when rewrite Classic layout changes (returned from compile + /api/version). */
export const CLASSIC_LAYOUT_VERSION = "classic-layout-v6";

type CvSnapshot = {
  profile: {
    id: string;
    workspaceId: string;
    displayName: string;
    headline: string;
    affiliation: string;
    location: string;
    email: string;
    websiteUrl: string;
    orcidUrl: string;
    linkedinUrl: string;
    bio: string;
    researchSummary: string;
  };
  sections: {
    key: string;
    title: string;
    entries: {
      id: string;
      summary: string;
      data: unknown;
    }[];
  }[];
};
type EntryData = Record<string, unknown>;

const MAX_NARRATIVE = 4000;
const MAX_TITLE = 320;
const MAX_URL = 500;
const MAX_SHORT = 80;

const sectionNameOverrides: Record<string, string> = {
  experience: "Professional Experience",
  academic_appointments: "Academic Appointments",
  research_experience: "Research Experience",
  research_interests: "Research Interests",
  invited_talks: "Invited Talks",
  academic_service: "Academic Service",
  editorial: "Editorial & Review Service",
  memberships: "Professional Memberships",
  professional_memberships: "Professional Memberships",
  grants: "Grants & Fellowships",
  projects: "Research Projects",
  awards: "Awards & Honors",
  conferences: "Conference Presentations",
  declaration: "Declaration",
  references: "References",
  supervision: "Supervision",
  certifications: "Certifications"
};

const storageRoot = process.env.CVSCHOLAR_FILE_STORAGE_DIR || path.join(process.cwd(), "storage");
const outputRoot = path.join(storageRoot, "generated");
const tempRoot = path.join(storageRoot, "temp", "latex");

export type LatexCompileResult =
  | {
      ok: true;
      pdfPath: string;
      pdfFilename: string;
      engine: string;
      durationMs: number;
      layoutVersion: string;
    }
  | { ok: false; error: string; engine: string; durationMs: number; log?: string; layoutVersion: string };

export async function compileClassicPdf(snapshot: CvSnapshot, profileId: string): Promise<LatexCompileResult> {
  const started = Date.now();
  const engine = resolveLatexEngine();

  if (!engine) {
    return {
      ok: false,
      error: "No LaTeX compiler found. Install tectonic or xelatex in the rewrite container.",
      engine: "none",
      durationMs: Date.now() - started,
      layoutVersion: CLASSIC_LAYOUT_VERSION
    };
  }

  const tempDir = path.join(tempRoot, `${profileId}_${crypto.randomBytes(4).toString("hex")}`);
  const finalDir = path.join(outputRoot, profileId);
  const texPath = path.join(tempDir, "cv.tex");
  const pdfPath = path.join(finalDir, "classic-cv.pdf");

  await mkdir(tempDir, { recursive: true });
  await mkdir(finalDir, { recursive: true });

  try {
    const tex = buildClassicLatex(snapshot);
    await writeFile(texPath, tex, "utf8");

    const result =
      engine === "tectonic"
        ? await runCommand("tectonic", ["--keep-logs", "--keep-intermediates", "--outdir", tempDir, texPath], tempDir)
        : await runXelatex(texPath, tempDir);

    const builtPdf = path.join(tempDir, "cv.pdf");
    if (!result.ok || !existsSync(builtPdf)) {
      const failure = latexFailureMessage(result.log);
      return {
        ok: false,
        error: failure,
        engine,
        durationMs: Date.now() - started,
        log: result.log.slice(-4000),
        layoutVersion: CLASSIC_LAYOUT_VERSION
      };
    }

    const bytes = await readFile(builtPdf);
    if (bytes.byteLength > 12 * 1024 * 1024) {
      return {
        ok: false,
        error: "Generated PDF exceeded the safety size limit.",
        engine,
        durationMs: Date.now() - started,
        layoutVersion: CLASSIC_LAYOUT_VERSION
      };
    }

    // Overwrite previous PDF so preview never sticks on a stale file.
    await writeFile(pdfPath, bytes);

    return {
      ok: true,
      pdfPath,
      pdfFilename: safeFilename(snapshot.profile.displayName || "academic-cv"),
      engine,
      durationMs: Date.now() - started,
      layoutVersion: CLASSIC_LAYOUT_VERSION
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function resolveLatexEngine() {
  if (process.env.CVSCHOLAR_LATEX_ENGINE) {
    return process.env.CVSCHOLAR_LATEX_ENGINE;
  }

  return "tectonic";
}

async function runXelatex(texPath: string, cwd: string) {
  const args = ["-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", `-output-directory=${cwd}`, texPath];
  const first = await runCommand("xelatex", args, cwd);
  if (!first.ok) return first;
  const second = await runCommand("xelatex", args, cwd);
  return { ok: second.ok, log: `${first.log}\n${second.log}` };
}

function runCommand(command: string, args: string[], cwd: string): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false });
    let log = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      log += "\n[killed after 45s]";
    }, 45_000);

    child.stdout.on("data", (chunk) => {
      log += String(chunk);
      if (log.length > 80_000) log = log.slice(-80_000);
    });
    child.stderr.on("data", (chunk) => {
      log += String(chunk);
      if (log.length > 80_000) log = log.slice(-80_000);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, log: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, log });
    });
  });
}

export function buildClassicLatex(snapshot: CvSnapshot) {
  const profile = snapshot.profile;
  const nameRaw = cleanField("displayName", profile.displayName || "Academic CV");
  const nameCmd = resolveNameFontCommand(nameRaw);
  const surname = extractSurname(nameRaw);

  const contactItems = [
    profile.email
      ? `\\href{${latexUrl(`mailto:${cleanField("email", profile.email)}`)}}{${latexText(cleanField("email", profile.email))}}`
      : "",
    profile.location ? latexText(cleanField("location", profile.location)) : "",
    profile.websiteUrl
      ? `\\href{${latexUrl(ensureUrl(profile.websiteUrl))}}{\\nolinkurl{${urlDisplay(profile.websiteUrl)}}}`
      : "",
    profile.orcidUrl
      ? `\\href{${latexUrl(ensureUrl(profile.orcidUrl))}}{ORCID: ${latexText(orcidDisplay(profile.orcidUrl))}}`
      : "",
    profile.linkedinUrl
      ? `\\href{${latexUrl(ensureUrl(profile.linkedinUrl))}}{LinkedIn: ${latexText(linkedinDisplay(profile.linkedinUrl))}}`
      : ""
  ]
    .filter(Boolean)
    .slice(0, 5);

  const contactLine = renderContactLine(contactItems);
  const tagline = [profile.headline, profile.affiliation]
    .map((value) => cleanField("title", value || ""))
    .filter(Boolean)
    .map(latexInline)
    .join(", ");

  const body = orderedSections(snapshot.sections)
    .map((section) => renderSection(section.key, sectionNameOverrides[section.key] ?? section.title, section.entries))
    .filter(Boolean)
    .join("\n");

  const pageFooter = surname
    ? `${latexText(surname)} \\textperiodcentered\\ \\thepage/\\pageref*{LastPage}`
    : `\\thepage/\\pageref*{LastPage}`;

  const bio = cleanField("summary", profile.bio || "");
  const research = cleanField("summary", profile.researchSummary || "");

  return String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=2.54cm]{geometry}
\usepackage{fontspec}
\defaultfontfeatures{Ligatures=TeX,Scale=MatchLowercase}
\setmainfont{Latin Modern Roman}
\setsansfont{Latin Modern Sans}
\setmonofont{Latin Modern Mono}
\usepackage{xcolor}
\PassOptionsToPackage{hyphens}{url}
\usepackage[hidelinks]{hyperref}
\usepackage{microtype}
\usepackage{enumitem}
\usepackage{parskip}
\usepackage{xurl}
\usepackage{ragged2e}
\usepackage{tabularx}
\usepackage{needspace}
\usepackage{seqsplit}
\usepackage{fancyhdr}
\usepackage{lastpage}
\Urlmuskip=0mu plus 2mu
\setlist{nosep,leftmargin=1.2em,topsep=2pt,partopsep=0pt,itemsep=2pt}
\definecolor{primary}{rgb}{0.000,0.000,0.000}
\definecolor{rule}{rgb}{0.78,0.80,0.85}
\setlength{\hfuzz}{3pt}
\newcommand{\cvsection}[1]{\par\vspace{0.85em}{\color{primary}\large\bfseries #1}\par\vspace{4.5pt}{\color{rule}\hrule height 0.6pt}\vspace{5pt}\nopagebreak}
\newcommand{\cventryhead}[2]{\noindent\begin{tabularx}{\textwidth}{@{}>{\raggedright\arraybackslash}X>{\raggedleft\arraybackslash}p{0.24\textwidth}@{}}\textbf{#1} & {\small\color{black!88}#2}\\\end{tabularx}\vspace{-0.25em}}
\newcommand{\cventrysub}[1]{\noindent\textit{\color{black!95}#1}\par\vspace{1pt}}
\newcommand{\cventrydesc}[1]{#1\par}
\newcommand{\cvsummary}[1]{#1\par\vspace{0.2em}}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.35em}
\setlength{\emergencystretch}{4em}
\hyphenpenalty=400
\exhyphenpenalty=400
\pagestyle{fancy}
\fancyhf{}
\fancyfoot[C]{\small\color{black!80}${pageFooter}}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
\raggedbottom
\RaggedRight
\sloppy
\begin{document}
\begin{center}
{\color{primary}${nameCmd}\bfseries ${latexText(nameRaw)}}${tagline ? `\\\\[0.25em]\n{\\normalsize ${tagline}}` : ""}${contactLine ? `\\\\[0.45em]\n{\\small\\color{black!90} ${contactLine}}` : ""}
\end{center}
\vspace{0.4em}
${bio ? `\\Needspace{5\\baselineskip}\n\\cvsection{Profile}\n\\cvsummary{${latexParagraph(bio)}}` : ""}
${research ? `\\Needspace{5\\baselineskip}\n\\cvsection{Research Summary}\n\\cvsummary{${latexParagraph(research)}}` : ""}
${body}
\end{document}
`;
}

function orderedSections(sections: CvSnapshot["sections"]) {
  const rank = (key: string) => (key === "declaration" ? 4 : key === "references" ? 3 : key === "publications" ? 2 : 1);
  return [...sections]
    .filter((section) => section.entries.length > 0)
    .sort((a, b) => rank(a.key) - rank(b.key));
}

function renderSection(sectionKey: string, title: string, entries: CvSnapshot["sections"][number]["entries"]) {
  if (sectionKey === "declaration") {
    const entry = entries.find((item) => Object.values(item.data as EntryData).some((value) => typeof value === "string" && value.trim()));
    return entry ? renderDeclaration(entry.data as EntryData) : "";
  }

  if (sectionKey === "publications") {
    const items = entries.map((entry) => renderPublication(entry.data as EntryData)).filter(Boolean);
    return items.length
      ? `\\Needspace{8\\baselineskip}\n\\cvsection{${latexText(title)}}\n\\begin{enumerate}[leftmargin=1.65em,label={[\\arabic*]},itemsep=6pt,topsep=0pt]\n${items.join("\n")}\n\\end{enumerate}\n`
      : "";
  }

  const rendered = entries
    .map((entry) => renderEntry(sectionKey, entry.data as EntryData))
    .filter(Boolean)
    .join("\n");
  return rendered ? `\\Needspace{8\\baselineskip}\n\\cvsection{${latexText(title)}}\n${rendered}` : "";
}

function renderPublication(data: EntryData) {
  const authors = latexInline(getValue(data, "authors"));
  const year = latexInline(getValue(data, "year"));
  const title = latexInline(getValue(data, "title"));
  const venue = latexInline(getValue(data, "venue"));
  const vip = latexInline(getValue(data, "volume_issue_pages"));
  const doi = cleanField("doi", getValue(data, "doi"));
  const url = cleanField("url", getValue(data, "url"));
  const status = latexInline(getValue(data, "status"));
  const pubType = latexInline(getValue(data, "publication_type"));

  const bits = [
    authors,
    year ? `(${year}).` : "",
    title ? `"${title}."` : "",
    venue ? `\\textit{${venue}}.` : "",
    vip ? `${vip}.` : "",
    pubType ? `[${pubType}]` : "",
    status && status.toLowerCase() !== "published" ? `[${status}]` : ""
  ].filter(Boolean);

  // Prefer DOI over raw URL.
  if (doi) {
    const href = /^https?:\/\//i.test(doi) ? doi : `https://doi.org/${doi.replace(/^\//, "")}`;
    bits.push(`DOI: \\href{${latexUrl(href)}}{${latexText(doi)}}`);
  } else if (url) {
    bits.push(`\\href{${latexUrl(ensureUrl(url))}}{\\nolinkurl{${urlDisplay(url)}}}`);
  }

  return bits.length ? `\\Needspace{4\\baselineskip}\\item \\begin{samepage}${bits.join(" ")}\\end{samepage}` : "";
}

function renderEntry(sectionKey: string, data: EntryData) {
  const isSupervision = sectionKey === "supervision";
  const isMembership = sectionKey === "memberships" || sectionKey === "professional_memberships";
  const isReferences = sectionKey === "references";

  let title = "";
  if (isSupervision) {
    title = firstValue(data, ["student_name", "name", "student"]) || firstValue(data, ["degree", "title"]);
  } else if (isMembership) {
    title = firstValue(data, ["organization", "institution", "name"]);
  } else if (isReferences) {
    title = firstValue(data, ["name", "title"]);
  } else {
    title = firstValue(data, [
      "position",
      "degree",
      "qualification",
      "title",
      "name",
      "course",
      "activity",
      "journal",
      "language",
      "interest",
      "area",
      "role",
      "category"
    ]);
  }

  const org = isMembership
    ? ""
    : firstValue(data, [
        "institution",
        "organization",
        "department",
        "publisher",
        "venue",
        "event",
        "conference",
        "journal",
        "issuer",
        "agency",
        "funder",
        "committee",
        "affiliation"
      ]);

  const location = getValue(data, "location");
  const description = firstValue(data, ["description", "details", "topic", "skills", "outputs", "collaborators", "summary"]);
  const years =
    yearRange(getValue(data, "year_start"), getValue(data, "year_end"), isSupervision ? "Ongoing" : undefined) ||
    normalizeYear(getValue(data, "year")) ||
    getValue(data, "date");

  const subParts: string[] = [];
  if (org) subParts.push(org);
  if (location) subParts.push(location);

  if (isMembership && getValue(data, "role")) subParts.push(getValue(data, "role"));
  if (isSupervision) {
    if (getValue(data, "degree")) subParts.push(getValue(data, "degree"));
    if (getValue(data, "role")) subParts.push(getValue(data, "role"));
    if (!org && getValue(data, "institution")) subParts.push(getValue(data, "institution"));
  }
  if (isReferences) {
    if (getValue(data, "title") && getValue(data, "title") !== title) subParts.push(getValue(data, "title"));
    if (getValue(data, "relationship")) subParts.push(`(${getValue(data, "relationship")})`);
  }
  if (sectionKey === "research_interests" && getValue(data, "keywords")) {
    subParts.push(`Keywords: ${getValue(data, "keywords")}`);
  }
  if (sectionKey === "editorial" && getValue(data, "role")) subParts.push(getValue(data, "role"));
  if (sectionKey === "grants" && getValue(data, "amount")) subParts.push(getValue(data, "amount"));

  const sub = subParts.filter(Boolean).map(latexInline).join(", ");
  const notes = buildNotes(sectionKey, data);
  const descRaw = description;
  const longBody = plainLength(descRaw) > 700;

  if (!title && !sub && !description && !notes) return "";

  const head = [
    title || years ? `\\cventryhead{${latexInline(title)}}{${latexInline(years)}}` : "",
    sub ? `\\cventrysub{${sub}}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  if (longBody) {
    return [
      "\\Needspace{5\\baselineskip}",
      head ? `\\begin{samepage}\n${head}\n\\end{samepage}` : "",
      description ? `\\cventrydesc{${latexParagraph(description)}}` : "",
      notes ? `\\cventrydesc{{\\small ${notes}}}` : "",
      "\\vspace{0.45em}"
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "\\Needspace{5\\baselineskip}",
    "\\begin{samepage}",
    head,
    description ? `\\cventrydesc{${latexParagraph(description)}}` : "",
    notes ? `\\cventrydesc{{\\small ${notes}}}` : "",
    "\\end{samepage}",
    "\\vspace{0.45em}"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildNotes(sectionKey: string, data: EntryData) {
  const notes: string[] = [];
  if (sectionKey === "references") {
    if (getValue(data, "email")) {
      notes.push(`\\href{${latexUrl(`mailto:${getValue(data, "email")}`)}}{${latexInline(getValue(data, "email"))}}`);
    }
    if (getValue(data, "phone")) notes.push(latexInline(getValue(data, "phone")));
  }
  if (sectionKey === "supervision") {
    const thesis = getValue(data, "thesis_title") || getValue(data, "thesis");
    if (thesis) notes.push(latexInline(`Thesis: ${thesis}`));
    if (getValue(data, "status")) notes.push(latexInline(getValue(data, "status")));
  }
  if (sectionKey === "education") {
    if (getValue(data, "thesis")) notes.push(latexInline(`Thesis: ${getValue(data, "thesis")}`));
    if (getValue(data, "supervisor")) notes.push(latexInline(`Supervisor: ${getValue(data, "supervisor")}`));
    if (getValue(data, "gpa")) notes.push(latexInline(getValue(data, "gpa")));
  }
  if (sectionKey === "grants" && getValue(data, "amount")) notes.push(latexInline(`Amount: ${getValue(data, "amount")}`));
  if (sectionKey === "grants" && getValue(data, "grant_number")) notes.push(latexInline(`Grant #: ${getValue(data, "grant_number")}`));
  if (sectionKey === "projects") {
    if (getValue(data, "collaborators")) notes.push(latexInline(`Collaborators: ${getValue(data, "collaborators")}`));
    if (getValue(data, "outputs")) notes.push(latexInline(`Outputs: ${getValue(data, "outputs")}`));
  }
  if (sectionKey === "conferences" && (getValue(data, "presentation_type") || getValue(data, "type"))) {
    notes.push(latexInline(`Type: ${getValue(data, "presentation_type") || getValue(data, "type")}`));
  }
  if (sectionKey === "patents" && getValue(data, "patent_number")) notes.push(latexInline(`Patent #: ${getValue(data, "patent_number")}`));
  if (sectionKey === "certifications" && getValue(data, "credential_id")) {
    notes.push(latexInline(`Credential: ${getValue(data, "credential_id")}`));
  }
  return notes.join(" \\textbar\\ ");
}

function renderDeclaration(data: EntryData) {
  const statement =
    cleanField(
      "statement",
      getValue(data, "statement") ||
        "I hereby declare that the information provided above is true and accurate to the best of my knowledge."
    );
  const date = cleanField("declaration_date", getValue(data, "declaration_date") || getValue(data, "date"));
  const name = cleanField("signature_name", getValue(data, "signature_name"));
  const signatureMode = getValue(data, "signature_mode").toLowerCase();
  const isElectronic = /electronic|digital|e-signature|esignature/.test(signatureMode);

  if (isElectronic) {
    return String.raw`\Needspace{8\baselineskip}
\begin{samepage}
\vspace{1.2em}
\noindent ${latexParagraph(statement)}\par\vspace{0.9em}
\noindent\begin{minipage}[t]{0.52\textwidth}
\textbf{Date:} ${date ? latexInline(date) : "\\rule{3.2cm}{0.4pt}"}\par
\end{minipage}\hfill
\begin{minipage}[t]{0.44\textwidth}
\raggedleft\textbf{Electronic Signature}\par
{\large\textit{${latexInline(name || "Authorized Signatory")}}}\par
{\footnotesize\color{black!85}Digitally signed}\par
\end{minipage}\par
\end{samepage}
\vspace{0.45em}
`;
  }

  return String.raw`\Needspace{8\baselineskip}
\begin{samepage}
\vspace{1.2em}
\noindent ${latexParagraph(statement)}\par\vspace{0.9em}
\noindent\textbf{Date:} ${date ? latexInline(date) : "\\rule{3.2cm}{0.4pt}"}\hfill\textbf{Signature:} \rule{5.5cm}{0.4pt}\par
${name ? `\\noindent\\hfill\\textit{${latexInline(name)}}\\par` : ""}
\end{samepage}
\vspace{0.45em}
`;
}

function yearRange(start: string, end: string, fallbackEnd?: string) {
  const s = normalizeYear(start);
  const e = normalizeYear(end);
  if (!s && !e) return "";
  if (s && !e) return fallbackEnd ? `${s} -- ${normalizeYear(fallbackEnd)}` : s;
  if (!s && e) return e;
  if (s.toLowerCase() === e.toLowerCase()) return s;
  return `${s} -- ${e}`;
}

function normalizeYear(value: string) {
  const v = value.trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  if (["present", "current", "now", "today"].includes(lower)) return "Present";
  if (["ongoing", "in progress", "in-progress", "continuing"].includes(lower)) return "Ongoing";
  return collapseWhitespace(v);
}

function firstValue(data: EntryData, keys: string[]) {
  for (const key of keys) {
    const value = getValue(data, key);
    if (value) return value;
  }
  return "";
}

function getValue(data: EntryData, key: string) {
  const value = data[key];
  if (typeof value === "string") return cleanField(key, value);
  if (typeof value === "number" || typeof value === "boolean") return cleanField(key, String(value));
  return "";
}

function cleanField(field: string, value: string) {
  let v = stripHtml(value);
  v = collapseWhitespace(v);
  if (!v) return "";

  const f = field.toLowerCase();
  if (/(year|date)$/.test(f) || f.includes("year")) return normalizeYear(v);
  if (f.includes("url") || ["doi", "website", "orcid", "linkedin", "github"].includes(f)) return softCap(v, MAX_URL);
  if (["description", "summary", "details", "statement", "bio", "abstract", "notes"].includes(f)) {
    return softCap(v, MAX_NARRATIVE);
  }
  if (["phone", "gpa", "status", "level", "code", "volume", "issue", "pages"].includes(f)) {
    return softCap(v, MAX_SHORT);
  }
  return softCap(v, MAX_TITLE);
}

function stripHtml(value: string) {
  let v = value;
  if (v.includes("&") || v.includes("&#")) {
    v = v
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'");
  }
  if (v.includes("<") && v.includes(">")) {
    v = v.replace(/<[^>]+>/g, " ");
  }
  return v.replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function collapseWhitespace(value: string) {
  return value
    .replace(/\r\n|\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function softCap(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(8, max - 1)).replace(/[\s.,;:-]+$/u, "")}…`;
}

function plainLength(value: string) {
  return value.length;
}

function latexParagraph(value: string) {
  return value
    .replace(/\r\n|\r/g, "\n")
    .split(/\n{2,}/)
    .map((line) => latexInline(line.replace(/\s+/g, " ").trim()))
    .filter(Boolean)
    .join("\\par ");
}

function latexInline(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/u);
  return parts
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return `\\textbf{${latexText(part.slice(2, -2).trim())}}`;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return `\\textit{${latexText(part.slice(1, -1).trim())}}`;
      }
      return latexBreakableText(part);
    })
    .join("");
}

function latexBreakableText(value: string) {
  return value
    .split(/(\s+)/u)
    .map((token) => {
      if (/^\s+$/u.test(token)) return token;
      if (token.length > 28 && !/^https?:\/\//i.test(token) && !token.includes("@")) {
        return `\\seqsplit{${latexText(token.replace(/[{}\\]/g, ""))}}`;
      }
      return latexText(token);
    })
    .join("");
}

function latexText(value: string) {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function latexUrl(value: string) {
  return `\\detokenize{${value.replace(/[\r\n{}]/g, "")}}`;
}

function latexFailureMessage(log: string) {
  const important = log
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /(^!|error|fatal|failed|not found|cannot|missing|undefined|emergency|no pages)/i.test(line))
    .slice(-4)
    .join(" ");

  if (!important) {
    return "LaTeX compilation failed. Check the PDF worker logs for details.";
  }

  return `LaTeX compilation failed: ${important.slice(0, 700)}`;
}

function ensureUrl(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

function shortUrl(value: string, maxDisplay = 52) {
  let short = value.replace(/^https?:\/\/(www\.)?/i, "").replace(/#.*/g, "").replace(/\/$/g, "");
  if (short.length <= maxDisplay) return short;
  const keep = Math.max(12, Math.floor((maxDisplay - 1) / 2));
  return `${short.slice(0, keep)}…${short.slice(-keep)}`;
}

function urlDisplay(value: string) {
  return shortUrl(value).replace(/[{}\\]/g, "");
}

function orcidDisplay(value: string) {
  const match = value.match(/(\d{4}-\d{4}-\d{4}-[\dX]{4})/i);
  if (match) return match[1].toUpperCase();
  return value.replace(/^https?:\/\/(www\.)?orcid\.org\//i, "");
}

function linkedinDisplay(value: string) {
  return value
    .replace(/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/in\//i, "")
    .replace(/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\//i, "")
    .replace(/[?#].*/, "")
    .replace(/^\/+|\/+$/g, "");
}

function renderContactLine(items: string[]) {
  if (!items.length) return "";
  const wrap = (item: string) => {
    const plain = item.replace(/\\[a-zA-Z]+|[{}]/g, "");
    return plain.length > 28 ? item : `\\mbox{${item}}`;
  };
  let line = wrap(items[0]);
  for (const item of items.slice(1)) {
    line += `\\allowbreak\\hspace{0.45em}\\textbullet\\hspace{0.45em}${wrap(item)}`;
  }
  return line;
}

function resolveNameFontCommand(name: string) {
  const len = name.trim().length;
  if (len > 55) return "\\large";
  if (len > 38) return "\\Large";
  return "\\Huge";
}

function extractSurname(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  if (!last || last.toLowerCase() === "curriculum") return "";
  return last.replace(/[.,;]+$/g, "");
}

function safeFilename(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "academic-cv";
  return `${base}-classic-cv.pdf`;
}
