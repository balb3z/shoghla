import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO, isValid } from "date-fns";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  Calendar,
  MapPin,
  Sparkles,
} from "lucide-react";
import { SourceBadge } from "@/components/brand";
import { saveJob, unsaveJob } from "@/lib/profile.functions";
import type { JobRecommendation } from "@/lib/profile.functions";

interface RecommendationCardProps {
  job: JobRecommendation;
  isSaved: boolean;
}

export function RecommendationCard({ job, isSaved: initialSaved }: RecommendationCardProps) {
  const saveFn = useServerFn(saveJob);
  const unsaveFn = useServerFn(unsaveJob);
  const qc = useQueryClient();

  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);

  const posted = safeRelative(job.date);
  const pct = job.match_percentage;
  const color =
    pct >= 80
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
      : pct >= 60
      ? "text-primary border-primary/40 bg-primary/10"
      : "text-amber-400 border-amber-500/40 bg-amber-500/10";

  async function toggleSave() {
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
            match_percentage: job.match_percentage,
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
      {/* Match badge */}
      <div className={`absolute right-4 top-4 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${color}`}>
        <Sparkles className="h-3 w-3" />
        {pct}% match
      </div>

      <div className="flex items-start gap-3 pr-24">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {job.title || "Untitled role"}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
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

      {/* Match reasons */}
      {job.match_reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.match_reasons.map((r, i) => (
            <span
              key={i}
              className="inline-flex rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-4">
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
          {saved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {saved ? "Saved" : "Save"}
        </button>

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
