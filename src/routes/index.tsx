import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Globe2,
  LayoutGrid,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { JobCard, JobCardSkeleton } from "@/components/job-card";
import { BrandMark } from "@/components/brand";
import { AuthButton } from "@/components/auth-button";
import shoghlaLogo from "@/assets/shoghla-logo.png";
import { listFilterOptions, listJobs } from "@/lib/jobs.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shoghla — Live job intelligence from every board" },
      {
        name: "description",
        content:
          "Search thousands of tech jobs aggregated from LinkedIn, Indeed, Wuzzuf, Remotive and more",
      },
      { property: "og:title", content: "Shoghla — Live job intelligence" },
      {
        property: "og:description",
        content: "One dashboard for every job listing worth applying to.",
      },
    ],
  }),
  component: HomePage,
});

type Since = "all" | "1d" | "7d" | "30d";

const SINCE_OPTIONS: { value: Since; label: string }[] = [
  { value: "all", label: "Anytime" },
  { value: "1d", label: "Past 24 hrs" },
  { value: "7d", label: "Past week" },
  { value: "30d", label: "Past month" },
];

const PAGE_SIZE = 24;

function HomePage() {
  const { user } = Route.useRouteContext();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [since, setSince] = useState<Since>("all");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const listJobsFn = useServerFn(listJobs);
  const listFiltersFn = useServerFn(listFilterOptions);

  const filtersQuery = useQuery({
    queryKey: ["filter-options"],
    queryFn: () => listFiltersFn(),
    staleTime: 5 * 60_000,
  });

  const jobsQuery = useQuery({
    queryKey: ["jobs", search, selectedSources, selectedLocations, since, page],
    queryFn: () =>
      listJobsFn({
        data: {
          search,
          sources: selectedSources,
          locations: selectedLocations,
          since,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
    placeholderData: (prev) => prev,
  });

  const total = jobsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (search) chips.push({ label: `“${search}”`, onRemove: () => { setSearch(""); setSearchInput(""); setPage(1); } });
    selectedSources.forEach((s) =>
      chips.push({ label: s, onRemove: () => { setSelectedSources((p) => p.filter((x) => x !== s)); setPage(1); } }),
    );
    selectedLocations.forEach((l) =>
      chips.push({ label: l, onRemove: () => { setSelectedLocations((p) => p.filter((x) => x !== l)); setPage(1); } }),
    );
    if (since !== "all")
      chips.push({ label: SINCE_OPTIONS.find((o) => o.value === since)?.label ?? since, onRemove: () => { setSince("all"); setPage(1); } });
    return chips;
  }, [search, selectedSources, selectedLocations, since]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function toggleSource(s: string) {
    setSelectedSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
    setPage(1);
  }
  function toggleLocation(l: string) {
    setSelectedLocations((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
    setPage(1);
  }
  function clearAll() {
    setSearch("");
    setSearchInput("");
    setSelectedSources([]);
    setSelectedLocations([]);
    setSince("all");
    setPage(1);
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <Sidebar
          filtersQuery={filtersQuery}
          selectedSources={selectedSources}
          selectedLocations={selectedLocations}
          since={since}
          onToggleSource={toggleSource}
          onToggleLocation={toggleLocation}
          onChangeSince={(v) => { setSince(v); setPage(1); }}
          onClear={clearAll}
          totalKnown={total}
          mobileOpen={mobileFiltersOpen}
          onCloseMobile={() => setMobileFiltersOpen(false)}
          desktopOpen={sidebarOpen}
          onCloseDesktop={() => setSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1">
          {/* Top nav */}
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface"
                aria-label="Open filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="hidden lg:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                aria-label={sidebarOpen ? "Collapse filters" : "Expand filters"}
                title={sidebarOpen ? "Collapse filters" : "Expand filters"}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </button>
              <div className="lg:hidden">
                <BrandMark compact />
              </div>
              <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center gap-2">
                <div className="relative flex min-w-0 flex-1 items-center">
                  <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by role or company — e.g. “data engineer” or “Vodafone”"
                    className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>
                <button
                  type="submit"
                  className="hidden sm:inline-flex h-11 items-center gap-1.5 rounded-xl gradient-accent px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </form>
              <AuthButton user={user} />
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {/* Hero + stats */}
            <section className="relative mb-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-background p-6 sm:p-10">
              {/* Decorative glow blobs */}
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-[oklch(0.78_0.14_210)]/15 blur-3xl" />
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.05]"
                style={{
                  backgroundImage:
                    "linear-gradient(oklch(0.97 0.005 250) 1px, transparent 1px), linear-gradient(90deg, oklch(0.97 0.005 250) 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
              />

              <div className="relative flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={shoghlaLogo}
                    alt="Shoghla"
                    className="h-20 w-20 shrink-0 object-contain drop-shadow-[0_0_14px_oklch(0.85_0.16_175_/_0.5)]"
                  />
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-primary">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    Live from the most popular job platforms
                  </div>
                </div>

                <div>
                  <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                    Every job worth applying to,{" "}
                    <span className="bg-gradient-to-r from-primary via-[oklch(0.82_0.15_190)] to-[oklch(0.78_0.14_210)] bg-clip-text text-transparent">
                      in one place.
                    </span>
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Search, filter and apply across LinkedIn, Indeed, Wuzzuf, Remotive and more — all
                    aggregated into a single, live-updating dashboard.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <HeroStat
                    icon={<LayoutGrid className="h-4 w-4" />}
                    label="Open roles"
                    value={total.toLocaleString()}
                    loading={jobsQuery.isPending && !jobsQuery.data}
                  />
                  <HeroStat
                    icon={<Globe2 className="h-4 w-4" />}
                    label="Sources"
                    value={(filtersQuery.data?.sources.length ?? 0).toLocaleString()}
                    loading={filtersQuery.isPending}
                  />
                  <HeroStat
                    icon={<Building2 className="h-4 w-4" />}
                    label="Locations"
                    value={(filtersQuery.data?.locations.length ?? 0).toLocaleString()}
                    loading={filtersQuery.isPending}
                  />
                </div>
              </div>
            </section>

            {/* Active filter chips */}
            {activeChips.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Filters
                </span>
                {activeChips.map((c, i) => (
                  <button
                    key={`${c.label}-${i}`}
                    onClick={c.onRemove}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    {c.label}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                <button
                  onClick={clearAll}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Toolbar */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LayoutGrid className="h-4 w-4" />
                {jobsQuery.isPending && !jobsQuery.data ? (
                  <span>Loading jobs…</span>
                ) : (
                  <span>
                    Showing{" "}
                    <span className="font-semibold text-foreground">
                      {(page - 1) * PAGE_SIZE + 1}–
                      {Math.min(page * PAGE_SIZE, total)}
                    </span>{" "}
                    of <span className="font-semibold text-foreground">{total.toLocaleString()}</span>
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
                {SINCE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSince(o.value); setPage(1); }}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                      since === o.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error banner */}
            {jobsQuery.data?.error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <div className="font-semibold text-destructive">Databricks query failed</div>
                  <div className="mt-1 break-words text-xs text-destructive/90">
                    {jobsQuery.data.error}
                  </div>
                </div>
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobsQuery.isPending && !jobsQuery.data
                ? Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)
                : jobsQuery.data?.jobs.map((job, i) => (
                    <JobCard key={`${job.url}-${i}`} job={job} />
                  ))}
            </div>

            {/* Empty */}
            {!jobsQuery.isPending && jobsQuery.data && jobsQuery.data.jobs.length === 0 && !jobsQuery.data.error && (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-surface">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="font-display text-lg font-semibold">No matching jobs</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try broadening your filters or clearing the search.
                </p>
                <button
                  onClick={clearAll}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm hover:border-primary/50 hover:text-primary"
                >
                  Reset filters
                </button>
              </div>
            )}

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm disabled:opacity-40 hover:border-primary/50"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <div className="text-sm text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </div>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm disabled:opacity-40 hover:border-primary/50"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
              
              <span className="font-mono text-foreground/80"></span> ·
              Shoghla © {new Date().getFullYear()}
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="flex min-w-[9.5rem] items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 shadow-[0_0_30px_-14px_oklch(0.85_0.16_175_/_0.5)]">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-primary/90">{label}</div>
        <div className="font-display text-xl font-bold tabular-nums text-foreground">
          {loading ? "—" : value}
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  filtersQuery,
  selectedSources,
  selectedLocations,
  since,
  onToggleSource,
  onToggleLocation,
  onChangeSince,
  onClear,
  totalKnown,
  mobileOpen,
  onCloseMobile,
  desktopOpen,
  onCloseDesktop,
}: {
  filtersQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listFilterOptions>>>>;
  selectedSources: string[];
  selectedLocations: string[];
  since: Since;
  onToggleSource: (s: string) => void;
  onToggleLocation: (l: string) => void;
  onChangeSince: (v: Since) => void;
  onClear: () => void;
  totalKnown: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  desktopOpen: boolean;
  onCloseDesktop: () => void;
}) {
  const sources = filtersQuery.data?.sources ?? [];
  const locations = filtersQuery.data?.locations ?? [];
  const loading = filtersQuery.isPending;

  const content = (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-5">
      <div className="hidden lg:flex items-center justify-between">
        <BrandMark />
        <button
          onClick={onCloseDesktop}
          aria-label="Collapse filters"
          title="Collapse filters"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <div className="lg:hidden flex items-center justify-between">
        <BrandMark />
        <button
          onClick={onCloseMobile}
          aria-label="Close filters"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Refine
        </div>
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          Reset
        </button>
      </div>

      <FilterGroup title="Posted">
        <div className="flex flex-col gap-1">
          {SINCE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onChangeSince(o.value)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                since === o.value
                  ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <span>{o.label}</span>
              {since === o.value && <span className="text-xs">✓</span>}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={`Source${selectedSources.length ? ` · ${selectedSources.length}` : ""}`}>
        {loading ? (
          <SkeletonList n={5} />
        ) : (
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
            {sources.map((s) => (
              <CheckRow
                key={s}
                label={s}
                checked={selectedSources.includes(s)}
                onChange={() => onToggleSource(s)}
              />
            ))}
            {sources.length === 0 && (
              <div className="text-xs text-muted-foreground">No sources available</div>
            )}
          </div>
        )}
      </FilterGroup>

      <FilterGroup title={`Location${selectedLocations.length ? ` · ${selectedLocations.length}` : ""}`}>
        {loading ? (
          <SkeletonList n={6} />
        ) : (
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
            {locations.slice(0, 40).map((l) => (
              <CheckRow
                key={l}
                label={l}
                icon={<MapPin className="h-3 w-3 text-muted-foreground" />}
                checked={selectedLocations.includes(l)}
                onChange={() => onToggleLocation(l)}
              />
            ))}
            {locations.length === 0 && (
              <div className="text-xs text-muted-foreground">No locations available</div>
            )}
          </div>
        )}
      </FilterGroup>

      <div className="mt-auto rounded-xl border border-border bg-surface/60 p-3 text-[11px] text-muted-foreground">
        Showing filters from {totalKnown.toLocaleString()} indexed roles.
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={`hidden lg:flex sticky top-0 h-screen shrink-0 flex-col overflow-hidden border-sidebar-border bg-sidebar transition-[width,border-width] duration-300 ease-in-out ${
          desktopOpen ? "w-72 border-r" : "w-0 border-r-0"
        }`}
      >
        <div className={`h-full w-72 transition-opacity duration-200 ${desktopOpen ? "opacity-100" : "opacity-0"}`}>
          {content}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs overflow-y-auto border-r border-sidebar-border bg-sidebar">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h4>
      {children}
    </section>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        checked ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      }`}
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
        }`}
      >
        {checked && <span className="text-[10px] leading-none">✓</span>}
      </span>
      {icon}
      <span className="truncate">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
    </label>
  );
}

function SkeletonList({ n }: { n: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-6 w-full animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
