import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

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

const sectionNameOverrides: Record<string, string> = {
  experience: "Appointments",
  research_interests: "Research Interests",
  memberships: "Memberships"
};

const storageRoot = process.env.CVSCHOLAR_FILE_STORAGE_DIR || path.join(process.cwd(), "storage");
const outputRoot = path.join(storageRoot, "generated");
const tempRoot = path.join(storageRoot, "temp", "latex");

export type LatexCompileResult =
  | { ok: true; pdfPath: string; pdfFilename: string; engine: string; durationMs: number }
  | { ok: false; error: string; engine: string; durationMs: number; log?: string };

export async function compileClassicPdf(snapshot: CvSnapshot, profileId: string): Promise<LatexCompileResult> {
  const started = Date.now();
  const engine = resolveLatexEngine();

  if (!engine) {
    return {
      ok: false,
      error: "No LaTeX compiler found. Install tectonic or xelatex in the rewrite container.",
      engine: "none",
      durationMs: Date.now() - started
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
        log: result.log.slice(-4000)
      };
    }

    const bytes = await readFile(builtPdf);
    if (bytes.byteLength > 12 * 1024 * 1024) {
      return {
        ok: false,
        error: "Generated PDF exceeded the safety size limit.",
        engine,
        durationMs: Date.now() - started
      };
    }

    await writeFile(pdfPath, bytes);

    return {
      ok: true,
      pdfPath,
      pdfFilename: safeFilename(snapshot.profile.displayName || "academic-cv"),
      engine,
      durationMs: Date.now() - started
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
  const contactItems = [
    profile.email ? `\\href{${latexUrl(`mailto:${profile.email}`)}}{${latexText(profile.email)}}` : "",
    profile.location ? latexText(profile.location) : "",
    profile.websiteUrl ? `\\href{${latexUrl(ensureUrl(profile.websiteUrl))}}{\\nolinkurl{${urlDisplay(profile.websiteUrl)}}}` : "",
    profile.orcidUrl ? `\\href{${latexUrl(ensureUrl(profile.orcidUrl))}}{ORCID: ${latexText(urlDisplay(profile.orcidUrl))}}` : "",
    profile.linkedinUrl ? `\\href{${latexUrl(ensureUrl(profile.linkedinUrl))}}{LinkedIn: ${latexText(urlDisplay(profile.linkedinUrl))}}` : ""
  ].filter(Boolean);
  const contactLine = contactItems.map((item) => `\\mbox{${item}}`).join("\\allowbreak\\hspace{0.45em}\\textbullet\\hspace{0.45em}");
  const tagline = [profile.headline, profile.affiliation].filter(Boolean).map(latexInline).join(", ");
  const body = orderedSections(snapshot.sections)
    .map((section) => renderSection(section.key, sectionNameOverrides[section.key] ?? section.title, section.entries))
    .filter(Boolean)
    .join("\n");

  return String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=2.1cm]{geometry}
\usepackage{fontspec}
\defaultfontfeatures{Ligatures=TeX}
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
\Urlmuskip=0mu plus 2mu
\setlist{nosep,leftmargin=1.2em,topsep=2pt,partopsep=0pt,itemsep=2pt}
\definecolor{primary}{rgb}{0.000,0.000,0.000}
\definecolor{rule}{rgb}{0.78,0.80,0.85}
\setlength{\hfuzz}{3pt}
\newcommand{\cvsection}[1]{\par\vspace{0.85em}{\color{primary}\large\bfseries #1}\par\vspace{2pt}{\color{rule}\hrule height 0.6pt}\vspace{5pt}\nopagebreak}
\newcommand{\cventryhead}[2]{\noindent\begin{tabularx}{\textwidth}{@{}>{\raggedright\arraybackslash}X>{\raggedleft\arraybackslash}p{0.24\textwidth}@{}}\textbf{#1} & {\small\color{black!60}#2}\\\end{tabularx}\vspace{-0.25em}}
\newcommand{\cventrysub}[1]{\noindent\textit{\color{black!75}#1}\par\vspace{1pt}}
\newcommand{\cventrydesc}[1]{#1\par}
\newcommand{\cvsummary}[1]{#1\par\vspace{0.2em}}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.35em}
\setlength{\emergencystretch}{4em}
\hyphenpenalty=400
\exhyphenpenalty=400
\pagestyle{empty}
\raggedbottom
\RaggedRight
\sloppy
\begin{document}
\begin{center}
{\color{primary}\Huge\bfseries ${latexText(profile.displayName || "Academic CV")}}${tagline ? `\\\\[0.25em]\n{\\normalsize ${tagline}}` : ""}${contactLine ? `\\\\[0.45em]\n{\\small\\color{black!70} ${contactLine}}` : ""}
\end{center}
\vspace{0.4em}
${profile.bio ? `\\Needspace{5\\baselineskip}\n\\cvsection{Profile}\n\\cvsummary{${latexParagraph(profile.bio)}}` : ""}
${profile.researchSummary ? `\\Needspace{5\\baselineskip}\n\\cvsection{Research Summary}\n\\cvsummary{${latexParagraph(profile.researchSummary)}}` : ""}
${body}
\end{document}
`;
}

function orderedSections(sections: CvSnapshot["sections"]) {
  const rank = (key: string) => (key === "references" ? 3 : key === "publications" ? 2 : 1);
  return [...sections]
    .filter((section) => section.entries.length > 0)
    .sort((a, b) => rank(a.key) - rank(b.key));
}

function renderSection(sectionKey: string, title: string, entries: CvSnapshot["sections"][number]["entries"]) {
  if (sectionKey === "publications") {
    const items = entries.map((entry) => renderPublication(entry.data as EntryData)).filter(Boolean);
    return items.length
      ? `\\Needspace{8\\baselineskip}\n\\cvsection{${latexText(title)}}\n\\begin{enumerate}[leftmargin=1.65em,label={[\\arabic*]},itemsep=6pt,topsep=0pt]\n${items.join("\n")}\n\\end{enumerate}\n`
      : "";
  }

  const rendered = entries.map((entry) => renderEntry(sectionKey, entry.data as EntryData)).filter(Boolean).join("\n");
  return rendered ? `\\Needspace{8\\baselineskip}\n\\cvsection{${latexText(title)}}\n${rendered}` : "";
}

function renderPublication(data: EntryData) {
  const bits = [
    latexInline(getValue(data, "authors")),
    getValue(data, "year") ? `(${latexInline(getValue(data, "year"))}).` : "",
    getValue(data, "title") ? `"${latexInline(getValue(data, "title"))}."` : "",
    getValue(data, "venue") ? `\\textit{${latexInline(getValue(data, "venue"))}}.` : "",
    getValue(data, "doi") ? `DOI: ${latexInline(getValue(data, "doi"))}` : "",
    getValue(data, "url") ? `\\href{${latexUrl(ensureUrl(getValue(data, "url")))}}{\\nolinkurl{${urlDisplay(getValue(data, "url"))}}}` : ""
  ].filter(Boolean);

  return bits.length ? `\\Needspace{4\\baselineskip}\\item \\begin{samepage}${bits.join(" ")}\\end{samepage}` : "";
}

function renderEntry(sectionKey: string, data: EntryData) {
  const title = firstValue(data, ["position", "degree", "qualification", "title", "name", "course", "activity", "organization", "language", "interest"]);
  const org = firstValue(data, ["institution", "organization", "publisher", "venue", "event", "issuer", "funder"]);
  const location = getValue(data, "location");
  const description = firstValue(data, ["description", "details", "topic", "role"]);
  const years = yearRange(getValue(data, "year_start"), getValue(data, "year_end")) || getValue(data, "year");
  const sub = [org, location].filter(Boolean).map(latexInline).join(", ");
  const notes = buildNotes(sectionKey, data);

  if (!title && !sub && !description && !notes) return "";

  return [
    "\\Needspace{5\\baselineskip}",
    "\\begin{samepage}",
    title || years ? `\\cventryhead{${latexInline(title)}}{${latexInline(years)}}` : "",
    sub ? `\\cventrysub{${sub}}` : "",
    description ? `\\cventrydesc{${latexParagraph(description)}}` : "",
    notes ? `\\cventrydesc{{\\small ${notes}}}` : "",
    "\\end{samepage}",
    "\\vspace{0.45em}"
  ].filter(Boolean).join("\n");
}

function buildNotes(sectionKey: string, data: EntryData) {
  const notes: string[] = [];
  if (sectionKey === "references") {
    if (getValue(data, "email")) notes.push(`\\href{${latexUrl(`mailto:${getValue(data, "email")}`)}}{${latexInline(getValue(data, "email"))}}`);
  }
  if (sectionKey === "grants" && getValue(data, "amount")) notes.push(latexInline(`Amount: ${getValue(data, "amount")}`));
  if (sectionKey === "conferences" && getValue(data, "type")) notes.push(latexInline(`Type: ${getValue(data, "type")}`));
  return notes.join(" \\textbar\\ ");
}

function yearRange(start: string, end: string) {
  if (!start && !end) return "";
  if (start && !end) return start;
  if (!start && end) return end;
  if (start.toLowerCase() === end.toLowerCase()) return start;
  return `${start} -- ${end}`;
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
  return typeof value === "string" ? value.trim() : "";
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

function urlDisplay(value: string) {
  return value.replace(/^https?:\/\/(www\.)?/i, "").replace(/[{}\\]/g, "").replace(/\/$/g, "");
}

function safeFilename(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "academic-cv";
  return `${base}-classic-cv.pdf`;
}
