import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO, isValid } from "date-fns";
import { ArrowUpRight, Bookmark, BookmarkCheck, Building2, Calendar, MapPin } from "lucide-react";
import { SourceBadge } from "@/components/brand";
import { saveJob, unsaveJob } from "@/lib/profile.functions";
import type { Job } from "@/lib/jobs.functions";

interface JobCardProps {
  job: Job;
  isSaved?: boolean;
  showSave?: boolean;
}

export function JobCard({ job, isSaved: initialSaved = false, showSave = false }: JobCardProps) {
  const saveFn = useServerFn(saveJob);
  const unsaveFn = useServerFn(unsaveJob);
  const qc = useQueryClient();

  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);

  const posted = safeRelative(job.date);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (saved) {
        await unsaveFn({ data: { url: job.url } });
        setSaved(false);
      } else {
        await saveFn({
          data: {
            job_title: job.title,
            company: job.company,
            location: job.location,
            url: job.url,
            source: job.source,
            date: job.date,
          },
        });
        setSaved(true);
      }
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
    } catch {
      // swallow
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="card-hover group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {job.title || "Untitled role"}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.company || "Unknown company"}</span>
          </div>
        </div>
        <SourceBadge source={job.source} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate max-w-[16rem]">{job.location}</span>
          </span>
        )}
        {posted && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {posted}
          </span>
        )}
      </div>

      <div
        className={`mt-auto flex items-center border-t border-border/60 pt-4 ${
          showSave ? "justify-between" : "justify-end"
        }`}
      >
        {showSave && (
          <button
            type="button"
            onClick={toggleSave}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              saved
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saved ? "Saved" : "Save"}
          </button>
        )}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg gradient-accent px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_-6px_oklch(0.85_0.16_175_/_0.5)] hover:opacity-90 transition-opacity"
        >
          Apply
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

function safeRelative(d: string) {
  if (!d) return "";
  const parsed = parseISO(d);
  if (!isValid(parsed)) return d;
  try {
    return formatDistanceToNow(parsed, { addSuffix: true });
  } catch {
    return d;
  }
}
