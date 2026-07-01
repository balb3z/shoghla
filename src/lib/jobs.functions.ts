import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Databricks is the sole source of truth for job listings. We talk to the
// SQL Statement Execution API directly — no third-party proxy in the
// middle. Configure via env vars (see .env.example / DEPLOYMENT.md):
//   DATABRICKS_HOST         e.g. "dbc-xxxxxxx-xxxx.cloud.databricks.com" (no scheme)
//   DATABRICKS_TOKEN        a personal access token or OAuth service-principal token
//   DATABRICKS_WAREHOUSE_ID defaults to the value below if unset
//   DATABRICKS_JOBS_TABLE   defaults to the value below if unset
const WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID ?? "0e86ac33271557a8";
const TABLE = process.env.DATABRICKS_JOBS_TABLE ?? "depi_project.philo_files.gold_jobs";

export interface Job {
  title: string;
  company: string;
  location: string;
  url: string;
  date: string; // ISO
  source: string;
}

export interface JobsResult {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

export interface FilterOptions {
  sources: string[];
  locations: string[];
  error?: string;
}

async function runSql(statement: string, parameters?: { name: string; value: string }[]) {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;
  if (!host || !token) {
    throw new Error("Databricks connection is not configured.");
  }

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
      ...(parameters ? { parameters } : {}),
    }),
  });

  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(`Databricks HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  const state = json?.status?.state;
  if (state !== "SUCCEEDED") {
    const msg = json?.status?.error?.message ?? `Query ${state}`;
    throw new Error(msg);
  }
  const columns: { name: string }[] = json?.manifest?.schema?.columns ?? [];
  const rows: string[][] = json?.result?.data_array ?? [];
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    columns.forEach((c, i) => (obj[c.name] = row[i]));
    return obj;
  });
}

// Escape single quotes for SQL string literals
function esc(v: string) {
  return v.replace(/'/g, "''");
}

const listJobsInput = z.object({
  search: z.string().optional().default(""),
  sources: z.array(z.string()).optional().default([]),
  locations: z.array(z.string()).optional().default([]),
  since: z.enum(["all", "1d", "7d", "30d"]).optional().default("all"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(24),
});

export const listJobs = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => listJobsInput.parse(raw))
  .handler(async ({ data }): Promise<JobsResult> => {
    const where: string[] = ["(source IS NULL OR lower(source) <> 'qatar')"];
    if (data.search.trim()) {
      const s = esc(data.search.trim().toLowerCase());
      where.push(`(lower(title) LIKE '%${s}%' OR lower(company) LIKE '%${s}%')`);
    }
    if (data.sources.length) {
      where.push(
        `source IN (${data.sources.map((s) => `'${esc(s)}'`).join(",")})`,
      );
    }
    if (data.locations.length) {
      where.push(
        `location IN (${data.locations.map((s) => `'${esc(s)}'`).join(",")})`,
      );
    }
    if (data.since !== "all") {
      const days = data.since === "1d" ? 1 : data.since === "7d" ? 7 : 30;
      where.push(`try_cast(date AS DATE) >= current_date() - INTERVAL ${days} DAYS`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (data.page - 1) * data.pageSize;

    try {
      const [countRows, jobRows] = await Promise.all([
        runSql(`SELECT COUNT(*) AS n FROM ${TABLE} ${whereSql}`),
        runSql(
          `SELECT title, company, location, url, CAST(date AS STRING) AS date, source
           FROM ${TABLE}
           ${whereSql}
           ORDER BY try_cast(date AS DATE) DESC NULLS LAST
           LIMIT ${data.pageSize} OFFSET ${offset}`,
        ),
      ]);

      const total = Number(countRows[0]?.n ?? 0);
      const jobs: Job[] = jobRows.map((r) => ({
        title: r.title ?? "",
        company: r.company ?? "",
        location: r.location ?? "",
        url: r.url ?? "",
        date: r.date ?? "",
        source: r.source ?? "",
      }));

      return { jobs, total, page: data.page, pageSize: data.pageSize };
    } catch (e) {
      return {
        jobs: [],
        total: 0,
        page: data.page,
        pageSize: data.pageSize,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

export const listFilterOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<FilterOptions> => {
    try {
      const [srcRows, locRows] = await Promise.all([
        runSql(
          `SELECT source, COUNT(*) AS n FROM ${TABLE} WHERE source IS NOT NULL AND lower(source) <> 'qatar' GROUP BY source ORDER BY n DESC LIMIT 50`,
        ),
        runSql(
          `SELECT location, COUNT(*) AS n FROM ${TABLE} WHERE location IS NOT NULL AND location <> '' GROUP BY location ORDER BY n DESC LIMIT 100`,
        ),
      ]);
      return {
        sources: srcRows.map((r) => r.source).filter(Boolean),
        locations: locRows.map((r) => r.location).filter(Boolean),
      };
    } catch (e) {
      return {
        sources: [],
        locations: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
);
