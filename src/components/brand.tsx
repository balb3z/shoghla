import { Globe2 } from "lucide-react";
import shoghlaLogo from "@/assets/shoghla-logo.png";

const SOURCE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  linkedin: { bg: "oklch(0.65 0.14 240 / 0.15)", text: "oklch(0.85 0.12 240)", ring: "oklch(0.65 0.14 240 / 0.4)" },
  indeed: { bg: "oklch(0.72 0.14 260 / 0.15)", text: "oklch(0.85 0.12 260)", ring: "oklch(0.72 0.14 260 / 0.4)" },
  wuzzuf: { bg: "oklch(0.75 0.15 40 / 0.15)", text: "oklch(0.85 0.13 40)", ring: "oklch(0.75 0.15 40 / 0.4)" },
  remotive: { bg: "oklch(0.78 0.15 155 / 0.15)", text: "oklch(0.86 0.14 155)", ring: "oklch(0.78 0.15 155 / 0.4)" },
  glassdoor: { bg: "oklch(0.72 0.14 155 / 0.15)", text: "oklch(0.85 0.12 155)", ring: "oklch(0.72 0.14 155 / 0.4)" },
};

export function SourceBadge({ source }: { source: string }) {
  const key = source.toLowerCase().trim();
  const style =
    SOURCE_STYLES[key] ?? {
      bg: "oklch(0.32 0.02 250)",
      text: "oklch(0.85 0.02 250)",
      ring: "oklch(0.5 0.02 250 / 0.4)",
    };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1"
      style={{ backgroundColor: style.bg, color: style.text, boxShadow: `inset 0 0 0 1px ${style.ring}` }}
    >
      <Globe2 className="h-3 w-3" />
      {source || "Unknown"}
    </span>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src={shoghlaLogo}
        alt="Shoghla"
        className={compact ? "h-8 w-8 object-contain" : "h-9 w-9 object-contain"}
      />
      <span className={compact ? "font-display text-base font-semibold" : "font-display text-lg font-semibold"}>
        Shoghla
      </span>
    </div>
  );
}
