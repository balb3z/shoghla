import {
  Briefcase,
  GraduationCap,
  Code2,
  Award,
  Cpu,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import type { CVData } from "@/lib/profile.functions";

export function CVDataDisplay({ cv }: { cv: CVData }) {
  return (
    <div className="space-y-6">
      {cv.summary && (
        <section className="rounded-2xl border border-border bg-surface/50 p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Summary
          </h3>
          <p className="text-sm leading-relaxed text-foreground">{cv.summary}</p>
        </section>
      )}

      {cv.skills.length > 0 && (
        <Section icon={<Cpu className="h-4 w-4" />} title="Skills">
          <div className="flex flex-wrap gap-2">
            {cv.skills.map((skill, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section icon={<Briefcase className="h-4 w-4" />} title="Experience">
          <div className="space-y-4">
            {cv.experience.map((exp, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground">{exp.title}</div>
                    <div className="text-sm text-primary">{exp.company}</div>
                  </div>
                  {exp.duration && (
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {exp.duration}
                    </span>
                  )}
                </div>
                {exp.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section icon={<GraduationCap className="h-4 w-4" />} title="Education">
          <div className="space-y-3">
            {cv.education.map((edu, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="font-semibold text-foreground">{edu.degree}</div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-sm text-primary">{edu.institution}</span>
                  {edu.year && (
                    <span className="text-xs text-muted-foreground">{edu.year}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section icon={<Code2 className="h-4 w-4" />} title="Projects">
          <div className="space-y-3">
            {cv.projects.map((proj, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="font-semibold text-foreground">{proj.name}</div>
                {proj.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {proj.description}
                  </p>
                )}
                {proj.technologies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {proj.technologies.map((t, j) => (
                      <span
                        key={j}
                        className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.certifications.length > 0 && (
        <Section icon={<Award className="h-4 w-4" />} title="Certifications">
          <div className="space-y-3">
            {cv.certifications.map((cert, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="font-semibold text-foreground">{cert.name}</div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-sm text-primary">{cert.issuer}</span>
                  {cert.year && (
                    <span className="text-xs text-muted-foreground">{cert.year}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-2xl border border-border bg-surface/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left hover:bg-surface/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}
