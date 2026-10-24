import { cn } from "@/lib/utils";
import { LEAD_STATUS_META, type LeadStatus, type StatusTone } from "@/lib/domain/lead-status";
import {
  DEVELOPMENT_AVAILABILITY_LABELS,
  PROPERTY_AVAILABILITY_LABELS,
  VIEWING_STATUS_LABELS,
  type DevelopmentAvailability,
  type PropertyAvailability,
  type ViewingStatus,
} from "@/lib/domain/constants";
import type { MicrositeState } from "@/lib/types";

const TONES: Record<StatusTone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-[#eef2f6] text-[#2f4a63] border-[#d9e2ec]",
  brass: "bg-brass-soft text-[#7a5d26] border-champagne",
  emerald: "bg-emerald-soft text-emerald-brand border-[#c8e2d6]",
  success: "bg-emerald-brand text-ivory border-emerald-brand",
  muted: "bg-muted text-muted-foreground border-border",
  danger: "bg-[#fbeceb] text-destructive border-[#f2cfcc]",
};

export function Pill({ tone, children, className, dot = true }: { tone: StatusTone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const meta = LEAD_STATUS_META[status];
  return (
    <Pill tone={meta.tone}>
      <span title={meta.description}>{meta.label}</span>
    </Pill>
  );
}

const PROPERTY_TONE: Record<PropertyAvailability, StatusTone> = {
  available: "emerald",
  reserved: "brass",
  sold: "muted",
  unavailable: "muted",
};

export function PropertyAvailabilityBadge({ status, archived }: { status: string; archived?: boolean }) {
  if (archived) return <Pill tone="muted">Archived</Pill>;
  const s = (status in PROPERTY_TONE ? status : "unavailable") as PropertyAvailability;
  return <Pill tone={PROPERTY_TONE[s]}>{PROPERTY_AVAILABILITY_LABELS[s]}</Pill>;
}

const DEVELOPMENT_TONE: Record<DevelopmentAvailability, StatusTone> = {
  upcoming: "info",
  available: "emerald",
  limited: "brass",
  sold_out: "muted",
};

export function DevelopmentAvailabilityBadge({ status }: { status: string }) {
  const s = (status in DEVELOPMENT_TONE ? status : "available") as DevelopmentAvailability;
  return <Pill tone={DEVELOPMENT_TONE[s]}>{DEVELOPMENT_AVAILABILITY_LABELS[s]}</Pill>;
}

const VIEWING_TONE: Record<ViewingStatus, StatusTone> = {
  requested: "brass",
  contacted: "info",
  confirmed: "success",
  rescheduled: "emerald",
  completed: "neutral",
  cancelled: "muted",
};

export function ViewingStatusBadge({ status }: { status: string }) {
  const s = (status in VIEWING_TONE ? status : "requested") as ViewingStatus;
  return <Pill tone={VIEWING_TONE[s]}>{VIEWING_STATUS_LABELS[s]}</Pill>;
}

export function MicrositeStateBadge({ state, opened }: { state: MicrositeState | null; opened?: boolean }) {
  if (!state) return <Pill tone="muted" dot={false}>No microsite</Pill>;
  if (state === "revoked") return <Pill tone="danger">Revoked</Pill>;
  if (state === "expired") return <Pill tone="muted">Expired</Pill>;
  return <Pill tone={opened ? "emerald" : "info"}>{opened ? "Opened" : "Not opened yet"}</Pill>;
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border border-dashed border-brass/60 px-1.5 text-[0.65rem] font-semibold tracking-wider text-brass uppercase",
        className,
      )}
      title="Fictional sample data for development and demonstrations"
    >
      Sample
    </span>
  );
}
