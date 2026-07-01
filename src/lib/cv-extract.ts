// ─── Local, dependency-free CV parsing (no external AI API) ──────────────────
//
// Text is pulled out of the uploaded file with pdf-parse (PDF) or mammoth
// (DOCX) in profile.functions.ts, then handed to `extractCVData` below, which
// uses section-header detection + keyword matching to build the same
// `CVData` shape the UI already expects. Nothing here calls out to the
// network — it's all plain string/regex processing.

import type { CVData } from "./profile.functions";

// A broad keyword bank covering tech, business, and soft skills commonly
// found on CVs. Matching is case-insensitive and word-boundary aware so
// "React" matches "React.js", "react native", etc. without pulling in
// unrelated substrings.
const KNOWN_SKILLS = [
  // Programming languages
  "javascript", "typescript", "python", "java", "c++", "c#", "php", "ruby", "go", "golang",
  "rust", "swift", "kotlin", "scala", "r", "matlab", "dart", "perl", "objective-c", "sql", "bash", "shell",
  // Frontend
  "react", "react native", "vue", "angular", "next.js", "nuxt", "svelte", "html", "css", "sass",
  "tailwind", "tailwindcss", "redux", "webpack", "vite", "jquery", "bootstrap",
  // Backend / frameworks
  "node.js", "nodejs", "express", "django", "flask", "fastapi", "spring", "spring boot", ".net",
  "asp.net", "laravel", "rails", "ruby on rails", "graphql", "rest api", "grpc", "microservices",
  // Data / AI
  "machine learning", "deep learning", "data science", "data analysis", "data engineering",
  "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras", "nlp",
  "computer vision", "power bi", "tableau", "excel", "spss", "sas", "big data",
  "spark", "hadoop", "databricks", "airflow", "etl",
  // Databases
  "mysql", "postgresql", "postgres", "mongodb", "redis", "oracle", "sqlite", "elasticsearch",
  "dynamodb", "firebase", "supabase", "nosql",
  // Cloud / DevOps
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform", "ansible",
  "jenkins", "ci/cd", "linux", "git", "github", "gitlab", "devops", "nginx",
  // Design
  "figma", "adobe photoshop", "adobe illustrator", "adobe xd", "sketch", "ui/ux", "ui design",
  "ux design", "graphic design", "canva", "indesign", "premiere pro", "after effects",
  // Business / marketing / sales
  "project management", "agile", "scrum", "kanban", "jira", "confluence",
  "digital marketing", "seo", "sem", "social media marketing", "content marketing",
  "google analytics", "google ads", "facebook ads", "email marketing", "crm", "salesforce",
  "hubspot", "sales", "business development", "market research", "brand management",
  // Finance / accounting / HR
  "financial analysis", "financial modeling", "accounting", "bookkeeping", "quickbooks",
  "sap", "erp", "budgeting", "forecasting", "auditing", "taxation", "payroll",
  "recruitment", "talent acquisition", "hr management", "onboarding", "performance management",
  // Office / general
  "microsoft office", "word", "powerpoint", "outlook", "google workspace", "slack", "notion",
  "erp systems", "typing", "data entry",
  // Languages
  "arabic", "english", "french", "german", "spanish", "italian", "mandarin",
  // Soft skills
  "leadership", "communication", "teamwork", "problem solving", "critical thinking",
  "time management", "adaptability", "creativity", "negotiation", "public speaking",
  "customer service", "attention to detail", "analytical skills", "collaboration",
  "decision making", "conflict resolution", "mentoring", "presentation skills",
];

const DEGREE_KEYWORDS = [
  "bachelor of science", "bachelor of arts", "bachelor of engineering", "bachelor of commerce",
  "bachelor's degree", "bachelor", "b.sc", "bsc", "b.a.", "b.eng", "b.tech",
  "master of science", "master of arts", "master of business administration", "master's degree",
  "master", "m.sc", "msc", "m.a.", "mba", "m.eng", "m.tech",
  "phd", "ph.d", "doctorate", "doctoral",
  "diploma", "associate degree", "high school diploma",
];

const SECTION_HEADERS: Record<string, string[]> = {
  summary: ["summary", "professional summary", "objective", "career objective", "profile", "about me", "personal profile"],
  experience: ["experience", "work experience", "employment history", "professional experience", "work history", "career history"],
  education: ["education", "academic background", "academic qualifications", "qualifications"],
  skills: ["skills", "technical skills", "core competencies", "key skills", "skills & abilities", "areas of expertise"],
  projects: ["projects", "personal projects", "key projects", "academic projects"],
  certifications: ["certifications", "certificates", "licenses & certifications", "licenses"],
};

type Section = keyof typeof SECTION_HEADERS;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findKeywordMatches(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const kw of keywords) {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(kw)}(?![a-z0-9])`, "i");
    if (pattern.test(lower)) found.push(kw);
  }
  return found;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Group raw CV lines into sections using header-line detection. */
function splitIntoSections(text: string): { preamble: string[]; sections: Record<Section, string[]> } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const sections: Record<Section, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  };
  const preamble: string[] = [];

  let current: Section | null = null;
  for (const line of lines) {
    const cleaned = line.replace(/[:：]+$/, "").trim();
    const lower = cleaned.toLowerCase();

    // A "header line" is short and matches (or closely matches) one of our
    // known section titles — real content lines are almost always longer.
    let matchedSection: Section | null = null;
    if (cleaned.length <= 40) {
      for (const [section, headers] of Object.entries(SECTION_HEADERS) as [Section, string[]][]) {
        if (headers.some((h) => lower === h || lower.startsWith(h + " ") || lower === h + "s")) {
          matchedSection = section;
          break;
        }
      }
    }

    if (matchedSection) {
      current = matchedSection;
      continue;
    }

    if (current) sections[current].push(line);
    else preamble.push(line);
  }

  return { preamble, sections };
}

const DATE_RANGE_RE =
  /((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{4}|\d{4})\s*(?:-|–|—|to)\s*((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{4}|\d{4}|present|current|now)/i;

function parseExperience(lines: string[]): CVData["experience"] {
  const entries: CVData["experience"] = [];
  let currentEntry: CVData["experience"][number] | null = null;

  for (const rawLine of lines) {
    const dateMatch = rawLine.match(DATE_RANGE_RE);
    if (dateMatch) {
      // Start a new entry. Everything else on this line (minus the date) is
      // treated as "title, company".
      if (currentEntry) entries.push(currentEntry);
      const duration = dateMatch[0];
      const remainder = rawLine.replace(DATE_RANGE_RE, "").trim().replace(/[|,\-–—@]+\s*$/, "").trim();
      const parts = remainder.split(/\s*[|,–—@]\s*| at /i).filter(Boolean);
      currentEntry = {
        title: parts[0] ?? remainder,
        company: parts[1] ?? "",
        duration,
        description: "",
      };
    } else if (currentEntry) {
      currentEntry.description = currentEntry.description
        ? `${currentEntry.description} ${rawLine}`
        : rawLine;
    } else {
      // No date seen yet — this is likely a title/company line that precedes
      // its date on the next line. Stash it as a pending entry with no
      // duration yet; if a date line follows immediately after, merge in.
      currentEntry = { title: rawLine, company: "", duration: "", description: "" };
    }
  }
  if (currentEntry) entries.push(currentEntry);

  return entries
    .filter((e) => e.title && e.title.length < 120)
    .slice(0, 8)
    .map((e) => ({
      ...e,
      description: e.description.slice(0, 500),
    }));
}

function parseEducation(lines: string[]): CVData["education"] {
  const entries: CVData["education"] = [];
  const yearRe = /\b(19|20)\d{2}\b/g;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const degree = DEGREE_KEYWORDS.find((d) => lower.includes(d));
    if (!degree) continue;

    const years = line.match(yearRe);
    const year = years ? years[years.length - 1] : "";

    let institution = line
      .replace(new RegExp(escapeRegExp(degree), "i"), "")
      .replace(yearRe, "")
      .replace(/[,|\-–—]+/g, " ")
      .replace(/\b(in|of|from|at)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    entries.push({
      degree: titleCase(degree),
      institution: institution.slice(0, 100),
      year,
    });
  }

  return entries.slice(0, 5);
}

function parseCertifications(lines: string[]): CVData["certifications"] {
  const items = lines
    .flatMap((l) => l.split(/[•·▪‣∙]|^[-*]\s+/).map((s) => s.trim()))
    .filter((s) => s.length > 2 && s.length < 150);

  const yearRe = /\b(19|20)\d{2}\b/;
  return items.slice(0, 10).map((line) => {
    const yearMatch = line.match(yearRe);
    const name = line.replace(yearRe, "").trim().replace(/[,|\-–—]+\s*$/, "").trim();
    return { name, issuer: "", year: yearMatch ? yearMatch[0] : "" };
  });
}

function parseProjects(lines: string[]): CVData["projects"] {
  // Break into blocks: a new project starts at each bullet or short
  // title-like line; subsequent lines are its description.
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    const isBullet = /^[-*•·▪‣∙]\s*/.test(line);
    const looksLikeTitle = line.length < 60 && !isBullet && current.length === 0;
    if (isBullet || looksLikeTitle) {
      if (current.length) blocks.push(current);
      current = [line.replace(/^[-*•·▪‣∙]\s*/, "")];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  return blocks.slice(0, 6).map((block) => {
    const [name, ...rest] = block;
    const description = rest.join(" ").slice(0, 300);
    const technologies = findKeywordMatches(block.join(" "), KNOWN_SKILLS).slice(0, 8);
    return { name: name.slice(0, 100), description, technologies };
  });
}

/**
 * Parse raw CV text into structured data using section detection and
 * keyword matching only — no external AI calls.
 */
export function extractCVData(text: string): CVData {
  const cleaned = text.replace(/\u0000/g, "").trim();
  const { preamble, sections } = splitIntoSections(cleaned);

  // Skills: anything explicitly listed under a "Skills" heading, plus any
  // known-skill keyword found anywhere in the document (covers CVs that
  // don't use a dedicated skills section, or list skills inline).
  const listedSkills = sections.skills
    .flatMap((l) => l.split(/[,•·▪‣∙|/]|^[-*]\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 40 && !/^\d+$/.test(s));

  const keywordSkills = findKeywordMatches(cleaned, KNOWN_SKILLS).map(titleCase);

  const skillsSeen = new Set<string>();
  const skills: string[] = [];
  for (const s of [...listedSkills, ...keywordSkills]) {
    const key = s.toLowerCase();
    if (!skillsSeen.has(key)) {
      skillsSeen.add(key);
      skills.push(s);
    }
  }

  const experience = parseExperience(sections.experience);
  const education = parseEducation(sections.education);
  const certifications = parseCertifications(sections.certifications);
  const projects = parseProjects(sections.projects);

  const summarySource = sections.summary.length ? sections.summary : preamble;
  const summary = summarySource.join(" ").slice(0, 500);

  return {
    skills: skills.slice(0, 40),
    experience,
    education,
    projects,
    certifications,
    summary,
  };
}
