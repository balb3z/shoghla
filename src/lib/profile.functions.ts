import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "./supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CVData {
  skills: string[];
  experience: {
    title: string;
    company: string;
    duration: string;
    description: string;
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string[];
  }[];
  certifications: {
    name: string;
    issuer: string;
    year: string;
  }[];
  summary: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  cv_url: string | null;
  cv_filename: string | null;
  cv_data: CVData | null;
  updated_at: string;
}

export interface SavedJob {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  date: string;
  match_percentage: number | null;
  saved_at: string;
}

export interface JobRecommendation {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  date: string;
  match_percentage: number;
  match_reasons: string[];
}

// ─── Databricks helper (reused from jobs.functions) ───────────────────────────

const WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID ?? "0e86ac33271557a8";
const TABLE = process.env.DATABRICKS_JOBS_TABLE ?? "depi_project.philo_files.gold_jobs";

async function runSql(statement: string) {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;
  if (!host || !token) throw new Error("Databricks connection is not configured.");

  const res = await fetch(`https://${host}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      warehouse_id: WAREHOUSE_ID,
      statement,
      wait_timeout: "30s",
    }),
  });

  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`Databricks HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  const state = json?.status?.state;
  if (state !== "SUCCEEDED") {
    throw new Error(json?.status?.error?.message ?? `Query ${state}`);
  }
  const columns: { name: string }[] = json?.manifest?.schema?.columns ?? [];
  const rows: string[][] = json?.result?.data_array ?? [];
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    columns.forEach((c, i) => (obj[c.name] = row[i]));
    return obj;
  });
}

function esc(v: string) {
  return v.replace(/'/g, "''");
}

// ─── CV Extraction — free rule-based parser (no API key required) ─────────────

// Comprehensive skill keyword list covering tech, languages, frameworks, tools
const KNOWN_SKILLS = [
  // Languages
  "javascript","typescript","python","java","c++","c#","go","rust","ruby","php",
  "swift","kotlin","scala","r","matlab","perl","bash","shell","powershell","sql",
  "html","css","sass","less","xml","json","yaml","graphql","dart","elixir","haskell",
  // Frontend
  "react","vue","angular","svelte","next.js","nextjs","nuxt","gatsby","remix",
  "tailwind","bootstrap","material ui","redux","zustand","webpack","vite","rollup",
  "jquery","ember","backbone","lit","web components","pwa","spa",
  // Backend
  "node.js","nodejs","express","fastapi","flask","django","spring","laravel",
  "rails","asp.net","nestjs","hapi","koa","gin","echo","fiber","actix",
  "graphql","rest","grpc","microservices","api",
  // Databases
  "postgresql","mysql","sqlite","mongodb","redis","elasticsearch","cassandra",
  "dynamodb","firebase","supabase","neo4j","influxdb","clickhouse","snowflake",
  "databricks","bigquery","oracle","mssql","mariadb","couchdb",
  // Cloud & DevOps
  "aws","azure","gcp","google cloud","docker","kubernetes","terraform","ansible",
  "jenkins","github actions","gitlab ci","circleci","helm","prometheus","grafana",
  "nginx","apache","linux","ubuntu","debian","centos","vercel","netlify","heroku",
  "cloudflare","digitalocean","lambda","ec2","s3","rds","ecs","eks",
  // Data & ML
  "machine learning","deep learning","tensorflow","pytorch","keras","scikit-learn",
  "pandas","numpy","matplotlib","seaborn","spark","hadoop","kafka","airflow",
  "dbt","looker","tableau","power bi","nlp","computer vision","llm","ai",
  "data science","data engineering","etl","mlops","hugging face",
  // Mobile
  "react native","flutter","android","ios","xcode","android studio","expo",
  // Tools & Methods
  "git","github","gitlab","bitbucket","jira","confluence","notion","figma",
  "agile","scrum","kanban","tdd","ci/cd","devops","sre","microservices",
  "oauth","jwt","rest api","graphql api","websockets","linux","vim",
  // Soft / Domain
  "project management","leadership","communication","teamwork","problem solving",
];

// Section heading patterns
const SECTION_PATTERNS: Record<string, RegExp> = {
  summary:        /^(summary|profile|objective|about|professional\s+summary|career\s+objective)/i,
  experience:     /^(experience|work\s+experience|employment|professional\s+experience|work\s+history|career\s+history)/i,
  education:      /^(education|academic|qualification|degrees?|schooling|university|college)/i,
  skills:         /^(skills?|technical\s+skills?|core\s+competenc|technologies|tools|expertise|proficienc)/i,
  projects:       /^(projects?|personal\s+projects?|portfolio|open\s+source|side\s+projects?)/i,
  certifications: /^(certifications?|licenses?|credentials?|accreditations?|courses?|training)/i,
};

// Job title keywords for detecting experience entries
const TITLE_KEYWORDS = [
  "engineer","developer","manager","analyst","designer","architect","lead","head",
  "director","officer","consultant","specialist","coordinator","administrator",
  "scientist","researcher","intern","associate","senior","junior","principal",
  "staff","vp","president","founder","cto","ceo","coo","ciso",
];

// Degree keywords
const DEGREE_KEYWORDS = [
  "bachelor","master","phd","doctorate","b.sc","m.sc","b.eng","m.eng","mba",
  "b.a","m.a","associate","diploma","certificate","b.s.","m.s.","b.tech","m.tech",
];

// Certification issuer keywords
const CERT_ISSUERS = [
  "aws","google","microsoft","oracle","cisco","comptia","pmi","isaca","certified",
  "certification","coursera","udemy","linkedin","ibm","redhat","vmware","salesforce",
];

function extractCVRuleBased(text: string): CVData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // ── 1. Detect section boundaries ──────────────────────────────────────────
  type SectionName = "summary"|"experience"|"education"|"skills"|"projects"|"certifications"|"other";
  const sections: { name: SectionName; lines: string[] }[] = [];
  let currentSection: SectionName = "other";
  let currentLines: string[] = [];

  for (const line of lines) {
    // A heading is usually short (≤6 words) and matches a section keyword
    const isHeading = line.split(/\s+/).length <= 6 && Object.entries(SECTION_PATTERNS).some(
      ([, re]) => re.test(line),
    );
    if (isHeading) {
      if (currentLines.length) sections.push({ name: currentSection, lines: currentLines });
      currentSection = (Object.entries(SECTION_PATTERNS).find(([, re]) => re.test(line))?.[0] ?? "other") as SectionName;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length) sections.push({ name: currentSection, lines: currentLines });

  const get = (name: SectionName) => sections.filter((s) => s.name === name).flatMap((s) => s.lines);
  const allText = text.toLowerCase();

  // ── 2. Skills ─────────────────────────────────────────────────────────────
  const skillLines = get("skills");
  const skillsFromSection = skillLines
    .flatMap((l) => l.split(/[,|•·\-–/\\]/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 40);

  // Also scan full text for known skill keywords
  const scannedSkills = KNOWN_SKILLS.filter((sk) => {
    const re = new RegExp(`\\b${sk.replace(/[.+]/g, "\\$&")}\\b`, "i");
    return re.test(allText);
  });

  const skills = [
    ...new Set([
      ...skillsFromSection.filter((s) => s.length > 1),
      ...scannedSkills,
    ]),
  ].slice(0, 30);

  // ── 3. Experience ─────────────────────────────────────────────────────────
  const expLines = get("experience");
  const experience: CVData["experience"] = [];
  let i = 0;
  while (i < expLines.length) {
    const line = expLines[i];
    const hasTitle = TITLE_KEYWORDS.some((kw) => line.toLowerCase().includes(kw));
    const hasDuration = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|present|current)/i.test(line);

    if (hasTitle || (hasDuration && i < expLines.length - 1)) {
      // Try to grab title, company, duration from the next 2–3 lines
      const titleLine = line;
      const nextLine = expLines[i + 1] ?? "";
      const durationMatch = [line, nextLine, expLines[i + 2] ?? ""]
        .join(" ")
        .match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}[\s–\-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\w*\s*\d{0,4}|present|\d{4}\s*[-–]\s*(?:\d{4}|present)/i);

      // Collect description lines until next heading-like entry
      let j = i + 1;
      const descLines: string[] = [];
      while (j < expLines.length && j < i + 8) {
        const hasNextTitle = TITLE_KEYWORDS.some((kw) => expLines[j].toLowerCase().includes(kw));
        if (hasNextTitle && j > i + 1) break;
        descLines.push(expLines[j]);
        j++;
      }

      experience.push({
        title: titleLine.replace(/\s*[|·•–-]\s*.*/,"").trim(),
        company: nextLine.replace(/\s*[|·•–-]\s*.*/,"").trim(),
        duration: durationMatch?.[0]?.trim() ?? "",
        description: descLines.slice(0, 3).join(" ").slice(0, 200),
      });
      i = j;
    } else {
      i++;
    }
  }

  // ── 4. Education ──────────────────────────────────────────────────────────
  const eduLines = get("education");
  const education: CVData["education"] = [];
  for (let e = 0; e < eduLines.length; e++) {
    const line = eduLines[e];
    const isDegree = DEGREE_KEYWORDS.some((kw) => line.toLowerCase().includes(kw));
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    if (isDegree || yearMatch) {
      const next = eduLines[e + 1] ?? "";
      education.push({
        degree: line.replace(/\b(19|20)\d{2}\b/g, "").trim(),
        institution: next.split(/[,|]/)[0].trim(),
        year: yearMatch?.[0] ?? next.match(/\b(19|20)\d{2}\b/)?.[0] ?? "",
      });
    }
  }

  // ── 5. Projects ───────────────────────────────────────────────────────────
  const projLines = get("projects");
  const projects: CVData["projects"] = [];
  for (let p = 0; p < projLines.length; p++) {
    const line = projLines[p];
    // Project names are usually short lines followed by a description
    if (line.length > 3 && line.length < 80 && !/^[-•·]/.test(line)) {
      const descLine = projLines[p + 1] ?? "";
      const techs = KNOWN_SKILLS.filter((sk) => {
        const re = new RegExp(`\\b${sk.replace(/[.+]/g, "\\$&")}\\b`, "i");
        return re.test(line) || re.test(descLine);
      }).slice(0, 6);
      projects.push({
        name: line.trim(),
        description: descLine.trim().slice(0, 200),
        technologies: techs,
      });
      p++; // skip description line
    }
  }

  // ── 6. Certifications ─────────────────────────────────────────────────────
  const certLines = get("certifications");
  const certifications: CVData["certifications"] = [];
  for (const line of certLines) {
    if (line.length < 5) continue;
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    const issuer = CERT_ISSUERS.find((iss) => line.toLowerCase().includes(iss.toLowerCase())) ?? "";
    certifications.push({
      name: line.replace(/\b(19|20)\d{2}\b/g, "").replace(new RegExp(issuer, "i"), "").trim(),
      issuer,
      year: yearMatch?.[0] ?? "",
    });
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  const summaryLines = get("summary");
  const summary = summaryLines.join(" ").slice(0, 400).trim() ||
    // Fallback: first substantial paragraph from the "other" section
    get("other").find((l) => l.length > 60)?.slice(0, 300) ?? "";

  return {
    skills: skills.filter(Boolean),
    experience: experience.filter((e) => e.title),
    education: education.filter((e) => e.degree),
    projects: projects.filter((p) => p.name),
    certifications: certifications.filter((c) => c.name),
    summary,
  };
}

// ─── Match jobs to CV ─────────────────────────────────────────────────────────

async function matchJobsToCV(cvData: CVData): Promise<JobRecommendation[]> {
  const topSkills = cvData.skills.slice(0, 10);
  const jobTitles = cvData.experience.slice(0, 3).map((e) => e.title);

  if (topSkills.length === 0 && jobTitles.length === 0) return [];

  // Build a keyword search from the CV
  const keywords = [...topSkills, ...jobTitles]
    .filter(Boolean)
    .map((k) => k.toLowerCase().replace(/['"]/g, ""));

  const searchTerms = keywords
    .slice(0, 8)
    .map((k) => `lower(title) LIKE '%${esc(k)}%'`)
    .join(" OR ");

  const whereSql = searchTerms
    ? `WHERE (${searchTerms}) AND (source IS NULL OR lower(source) <> 'qatar')`
    : `WHERE source IS NULL OR lower(source) <> 'qatar'`;

  try {
    const rows = await runSql(
      `SELECT title, company, location, url, CAST(date AS STRING) AS date, source
       FROM ${TABLE}
       ${whereSql}
       ORDER BY try_cast(date AS DATE) DESC NULLS LAST
       LIMIT 50`,
    );

    // Score each job against the CV
    const scored = rows.map((r) => {
      const titleLower = (r.title ?? "").toLowerCase();
      let score = 0;
      const matchReasons: string[] = [];

      // Skill matching
      let skillMatches = 0;
      for (const skill of cvData.skills) {
        if (titleLower.includes(skill.toLowerCase())) {
          skillMatches++;
          matchReasons.push(`Matches your skill: ${skill}`);
        }
      }
      score += Math.min(skillMatches * 15, 60);

      // Title matching
      for (const expTitle of jobTitles) {
        const expWords = expTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const titleWords = titleLower.split(/\s+/);
        const overlap = expWords.filter((w) => titleWords.some((t) => t.includes(w)));
        if (overlap.length > 0) {
          score += Math.min(overlap.length * 10, 30);
          matchReasons.push(`Similar to your role: ${expTitle}`);
        }
      }

      // Recency bonus
      if (r.date) {
        const daysAgo = (Date.now() - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysAgo <= 7) score += 10;
        else if (daysAgo <= 30) score += 5;
      }

      const matchPct = Math.min(Math.max(score, 20), 98);
      return {
        title: r.title ?? "",
        company: r.company ?? "",
        location: r.location ?? "",
        url: r.url ?? "",
        source: r.source ?? "",
        date: r.date ?? "",
        match_percentage: matchPct,
        match_reasons: [...new Set(matchReasons)].slice(0, 3),
      };
    });

    return scored
      .filter((j) => j.match_percentage >= 25)
      .sort((a, b) => b.match_percentage - a.match_percentage)
      .slice(0, 20);
  } catch (e) {
    console.error("Job matching failed:", e);
    return [];
  }
}

// ─── Server Functions ──────────────────────────────────────────────────────────

/** Get the current user's profile */
export const getProfile = createServerFn({ method: "GET" }).handler(async (): Promise<UserProfile | null> => {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data ?? null;
  } catch (e) {
    console.error("getProfile failed:", e);
    return null;
  }
});

/** Upload CV to Supabase Storage and extract data with Claude */
export const uploadAndExtractCV = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const d = raw as { fileBase64: string; fileName: string; mimeType: string };
    return z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }).parse(d);
  })
  .handler(async ({ data }): Promise<{ success: boolean; error?: string; profile?: UserProfile }> => {
    try {
      const supabase = getSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Not authenticated" };

      // Decode base64 file
      const fileBuffer = Buffer.from(data.fileBase64, "base64");
      const ext = data.fileName.split(".").pop()?.toLowerCase() ?? "pdf";
      const storagePath = `cvs/${user.id}/resume.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("cv-uploads")
        .upload(storagePath, fileBuffer, {
          contentType: data.mimeType,
          upsert: true,
        });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from("cv-uploads")
        .getPublicUrl(storagePath);
      const cvUrl = urlData.publicUrl;

      // Extract text from the file
      let extractedText = "";
      if (data.mimeType === "application/pdf") {
        // For PDFs, use a text extraction approach via base64 decode + simple text scan
        // Since we're server-side, we parse printable ASCII from the PDF buffer
        extractedText = extractTextFromBuffer(fileBuffer, "pdf");
      } else {
        // For DOCX, extract XML text content
        extractedText = extractTextFromBuffer(fileBuffer, "docx");
      }

      // Extract structured CV data with the free rule-based parser
      const cvData = extractCVRuleBased(extractedText || data.fileName);

      // Save to Supabase
      const { data: profileData, error: upsertError } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: user.id,
          cv_url: cvUrl,
          cv_filename: data.fileName,
          cv_data: cvData,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" })
        .select()
        .single();

      if (upsertError) throw new Error(`Profile save failed: ${upsertError.message}`);

      return { success: true, profile: profileData };
    } catch (e) {
      console.error("uploadAndExtractCV failed:", e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

/** Get job recommendations based on user's CV */
export const getJobRecommendations = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ jobs: JobRecommendation[]; error?: string }> => {
    try {
      const supabase = getSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { jobs: [], error: "Not authenticated" };

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("cv_data")
        .eq("user_id", user.id)
        .single();

      if (!profile?.cv_data) return { jobs: [], error: "No CV uploaded yet" };

      const jobs = await matchJobsToCV(profile.cv_data as CVData);
      return { jobs };
    } catch (e) {
      console.error("getJobRecommendations failed:", e);
      return { jobs: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

/** Save a job for the current user */
export const saveJob = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const d = raw as {
      job_title: string; company: string; location: string;
      url: string; source: string; date: string; match_percentage?: number;
    };
    return z.object({
      job_title: z.string(),
      company: z.string(),
      location: z.string(),
      url: z.string(),
      source: z.string(),
      date: z.string(),
      match_percentage: z.number().optional(),
    }).parse(d);
  })
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    try {
      const supabase = getSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Not authenticated" };

      const { error } = await supabase.from("saved_jobs").upsert({
        user_id: user.id,
        job_title: data.job_title,
        company: data.company,
        location: data.location,
        url: data.url,
        source: data.source,
        date: data.date,
        match_percentage: data.match_percentage ?? null,
        saved_at: new Date().toISOString(),
      }, { onConflict: "user_id,url" });

      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

/** Remove a saved job */
export const unsaveJob = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ url: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    try {
      const supabase = getSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Not authenticated" };

      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("user_id", user.id)
        .eq("url", data.url);

      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

/** Get user's saved jobs */
export const getSavedJobs = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ jobs: SavedJob[]; error?: string }> => {
    try {
      const supabase = getSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { jobs: [] };

      const { data, error } = await supabase
        .from("saved_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false });

      if (error) throw error;
      return { jobs: data ?? [] };
    } catch (e) {
      return { jobs: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

// ─── Text extraction helpers ───────────────────────────────────────────────────

function extractTextFromBuffer(buf: Buffer, type: "pdf" | "docx"): string {
  if (type === "pdf") {
    // Extract printable ASCII strings from PDF binary
    const raw = buf.toString("latin1");
    const strings: string[] = [];
    let current = "";
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      if ((c >= 32 && c <= 126) || c === 10 || c === 13) {
        current += raw[i];
      } else {
        if (current.length > 3) strings.push(current.trim());
        current = "";
      }
    }
    if (current.length > 3) strings.push(current.trim());
    return strings
      .filter((s) => s.length > 4 && !/^[\d\s.,()\-/]+$/.test(s))
      .join(" ")
      .slice(0, 15000);
  } else {
    // DOCX is a ZIP — extract XML word/document.xml as text
    try {
      const raw = buf.toString("latin1");
      // Find word/document.xml content between XML tags
      const xmlMatch = raw.match(/word\/document\.xml[^<]*(<\?xml[\s\S]*?)<\/pkg:xmlData>/);
      if (xmlMatch) {
        return xmlMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 15000);
      }
      // Fallback: strip all XML-like tags from any segment
      const xmlContent = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return xmlContent.slice(0, 15000);
    } catch {
      return "";
    }
  }
}
