import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  FileText,
  Loader2,
  Sparkles,
  User,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

import { BrandMark } from "@/components/brand";
import { AuthButton } from "@/components/auth-button";
import { CVUploader } from "@/components/cv-uploader";
import { CVDataDisplay } from "@/components/cv-data-display";
import { RecommendationCard } from "@/components/recommendation-card";
import { SavedJobCard } from "@/components/saved-job-card";
import {
  getProfile,
  getJobRecommendations,
  getSavedJobs,
} from "@/lib/profile.functions";
import type { UserProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/profile")({
  beforeLoad: async ({ context }) => {
    const { user } = context;
    if (!user) {
      throw redirect({ to: "/", search: {} });
    }
    return { user };
  },
  head: () => ({
    meta: [{ title: "My Profile — Shoghla" }],
  }),
  component: ProfilePage,
});

type Tab = "cv" | "recommendations" | "saved";

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("cv");
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);

  const getProfileFn = useServerFn(getProfile);
  const getRecommendationsFn = useServerFn(getJobRecommendations);
  const getSavedFn = useServerFn(getSavedJobs);
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
    staleTime: 60_000,
  });

  const profile = localProfile ?? profileQuery.data ?? null;
  const hasCV = !!profile?.cv_data;

  const recommendationsQuery = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => getRecommendationsFn(),
    enabled: tab === "recommendations" && hasCV,
    staleTime: 5 * 60_000,
  });

  const savedJobsQuery = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: () => getSavedFn(),
    enabled: tab === "saved",
    staleTime: 30_000,
  });

  const savedUrls = new Set((savedJobsQuery.data?.jobs ?? []).map((j) => j.url));

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "cv", label: "My CV", icon: <FileText className="h-4 w-4" /> },
    {
      id: "recommendations",
      label: "Recommendations",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      id: "saved",
      label: "Saved Jobs",
      icon: <Bookmark className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="mb-8 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface hover:border-primary/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandMark compact />
          <div className="ml-auto">
            <AuthButton user={user} />
          </div>
        </header>

        {/* Profile Hero */}
        <section className="mb-8 flex flex-col gap-4 rounded-3xl border border-border bg-gradient-to-br from-surface to-background p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name ?? ""}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {user.name ?? "Your Profile"}
            </h1>
            {user.email && (
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            )}
            {hasCV && (
              <p className="mt-2 text-xs text-primary">
                ✓ CV uploaded — personalized recommendations ready
              </p>
            )}
          </div>
          {hasCV && (
            <div className="sm:ml-auto">
              <button
                type="button"
                onClick={() => {
                  setTab("recommendations");
                  qc.invalidateQueries({ queryKey: ["recommendations"] });
                }}
                className="inline-flex items-center gap-2 rounded-xl gradient-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_-6px_oklch(0.85_0.16_175_/_0.5)] hover:opacity-90 transition-opacity"
              >
                <Sparkles className="h-4 w-4" />
                View Recommendations
              </button>
            </div>
          )}
        </section>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-border bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "cv" && (
          <div className="space-y-8">
            <section className="rounded-3xl border border-border bg-surface/30 p-6 sm:p-8">
              <h2 className="mb-1 font-display text-xl font-bold text-foreground">
                Upload Your CV
              </h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Upload a PDF or DOCX resume. Claude will extract your skills, experience, and education
                to generate personalized job recommendations.
              </p>
              <CVUploader
                currentProfile={profile}
                onSuccess={(p) => {
                  setLocalProfile(p);
                  qc.setQueryData(["profile"], p);
                }}
              />
            </section>

            {hasCV && profile.cv_data && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold text-foreground">
                    Extracted CV Data
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    Last updated {new Date(profile.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <CVDataDisplay cv={profile.cv_data} />
              </section>
            )}

            {!hasCV && !profileQuery.isPending && (
              <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <div className="font-semibold text-foreground">No CV uploaded yet</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload your resume above to unlock AI-powered job recommendations.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "recommendations" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Personalized Recommendations
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Jobs matched to your skills and experience
                </p>
              </div>
              <button
                type="button"
                onClick={() => qc.invalidateQueries({ queryKey: ["recommendations"] })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {!hasCV && (
              <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <div className="font-semibold text-foreground">Upload your CV first</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  We need your resume to generate personalized recommendations.
                </p>
                <button
                  onClick={() => setTab("cv")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm hover:border-primary/50 hover:text-primary"
                >
                  Upload CV
                </button>
              </div>
            )}

            {hasCV && recommendationsQuery.isPending && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <RecommendationSkeleton key={i} />
                ))}
              </div>
            )}

            {hasCV && recommendationsQuery.data?.error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Could not load recommendations</div>
                  <div className="mt-1 text-xs">{recommendationsQuery.data.error}</div>
                </div>
              </div>
            )}

            {hasCV && !recommendationsQuery.isPending && recommendationsQuery.data && (
              <>
                {recommendationsQuery.data.jobs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {recommendationsQuery.data.jobs.map((job, i) => (
                      <RecommendationCard
                        key={`${job.url}-${i}`}
                        job={job}
                        isSaved={savedUrls.has(job.url)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
                    <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <div className="font-semibold text-foreground">No recommendations yet</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try refreshing, or check back later as new jobs are added.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "saved" && (
          <div>
            <div className="mb-6">
              <h2 className="font-display text-xl font-bold text-foreground">Saved Jobs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Jobs you've bookmarked for later
              </p>
            </div>

            {savedJobsQuery.isPending && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {savedJobsQuery.data && savedJobsQuery.data.jobs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {savedJobsQuery.data.jobs.map((job) => (
                  <SavedJobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              !savedJobsQuery.isPending && (
                <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
                  <Bookmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <div className="font-semibold text-foreground">No saved jobs yet</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bookmark jobs from your recommendations or the main feed.
                  </p>
                  <button
                    onClick={() => setTab("recommendations")}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm hover:border-primary/50 hover:text-primary"
                  >
                    View Recommendations
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendationSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
