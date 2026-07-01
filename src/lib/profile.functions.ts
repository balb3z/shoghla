import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import mammoth from "mammoth";
import { getSupabaseServerClient } from "./supabase/server";
import { extractCVData } from "./cv-extract";

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

/** Upload CV to Supabase Storage, extract its text, and parse skills/experience via keyword matching */
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

      // Extract text from the file — throws with a descriptive message on failure
      const isPdf = data.mimeType === "application/pdf" || ext === "pdf";
      let extractedText: string;
      try {
        extractedText = await extractTextFromBuffer(fileBuffer, isPdf ? "pdf" : "docx");
      } catch (e) {
        // Propagate the extraction error directly to the client; the file was
        // already uploaded successfully so we surface the real problem rather
        // than silently returning an empty profile.
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
      }

      // Extract structured CV data locally via section detection + keyword matching
      const cvData = extractCVData(extractedText);

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
// PDFs are parsed with pdfjs-dist (replaces pdf-parse which has a broken
// require path at runtime), DOCX files with mammoth. Both run entirely
// server-side (this file only ever executes inside createServerFn handlers).

async function extractPdfText(buf: Buffer): Promise<string> {
  // pdfjs-dist is imported dynamically so it only loads server-side and
  // avoids bundling the large worker into the client bundle.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // pdfjs-dist always tries to spin up a worker, and when none is available
  // it falls back to running the worker code on the main thread (a "fake
  // worker"). That fallback still reads `GlobalWorkerOptions.workerSrc`
  // internally and *throws* `No "GlobalWorkerOptions.workerSrc" specified.`
  // if it's falsy — and "" is falsy, which is exactly what was breaking
  // this (the previous `workerSrc = ""` line caused the reported
  // `Setting up fake worker failed: "No "GlobalWorkerOptions.workerSrc"
  // specified.".` error).
  //
  // The reliable fix for server-side/Node usage is to import the worker
  // module directly and expose it on `globalThis.pdfjsWorker`. pdfjs
  // checks for that global before it ever looks at `workerSrc`, so the
  // worker code runs in-process without needing a resolvable URL/path
  // (which is also what makes this safe inside a bundled server build).
  if (!(globalThis as any).pdfjsWorker) {
    const pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as any).pdfjsWorker = pdfjsWorker;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buf),
    // Suppress the "Setting up fake worker" console message
    verbosity: 0,
  });

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n").trim();
}

async function extractTextFromBuffer(buf: Buffer, type: "pdf" | "docx"): Promise<string> {
  if (type === "pdf") {
    let text: string;
    try {
      text = await extractPdfText(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`PDF parsing failed: ${msg}`);
    }
    if (!text) {
      throw new Error(
        "No text could be extracted from this PDF. It may be a scanned image — please export a text-based PDF or upload a DOCX instead.",
      );
    }
    return text.slice(0, 15000);
  } else {
    let result: Awaited<ReturnType<typeof mammoth.extractRawText>>;
    try {
      result = await mammoth.extractRawText({ buffer: buf });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`DOCX parsing failed: ${msg}`);
    }
    const text = (result.value ?? "").trim();
    if (!text) {
      throw new Error(
        "No text could be extracted from this DOCX file. The file may be corrupted or contain only images.",
      );
    }
    // Log any mammoth warnings (non-fatal) so they appear in server logs
    if (result.messages?.length) {
      console.warn("mammoth warnings:", result.messages.map((m) => m.message).join("; "));
    }
    return text.slice(0, 15000);
  }
}
