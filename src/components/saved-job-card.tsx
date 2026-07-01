import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO, isValid } from "date-fns";
import {
  ArrowUpRight,
  BookmarkX,
  Building2,
  Calendar,
  MapPin,
  Sparkles,
} from "lucide-react";
import { SourceBadge } from "@/components/brand";
import { unsaveJob } from "@/lib/profile.functions";
import type { SavedJob } from "@/lib/profile.functions";

export function SavedJobCard({ job }: { job: SavedJob }) {
  const unsaveFn = useServerFn(unsaveJob);
  const qc = useQueryClient();
  const [removing, setRemoving] = useState(false);

  const posted = safeRelative(job.date);

  async function remove() {
    setRemoving(true);
    try {
      await unsaveFn({ data: { url: job.url } });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
    } catch {
      setRemoving(false);
    }
  }

  return (
    <article className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      {job.match_percentage && (
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
          <Sparkles className="h-3 w-3" />
          {job.match_percentage}% match
        </div>
      )}

      <div className={`flex items-start gap-3 ${job.match_percentage ? "pr-28" : ""}`}>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {job.job_title || "Untitled role"}
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

      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-4">
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
        >
          <BookmarkX className="h-4 w-4" />
          {removing ? "Removing…" : "Unsave"}
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
