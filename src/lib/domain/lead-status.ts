export const LEAD_STATUSES = [
  "new",
  "microsite_generated",
  "contacted",
  "engaged",
  "viewing_requested",
  "viewing_scheduled",
  "converted",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type StatusTone = "neutral" | "info" | "brass" | "emerald" | "success" | "muted" | "danger";

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; tone: StatusTone; description: string }> = {
  new: { label: "New", tone: "neutral", description: "Enquiry received, no microsite yet" },
  microsite_generated: { label: "Microsite generated", tone: "info", description: "A personalised link exists but has not been confirmed as sent" },
  contacted: { label: "Contacted", tone: "brass", description: "An agent confirmed they messaged the buyer" },
  engaged: { label: "Engaged", tone: "emerald", description: "The buyer has opened their microsite" },
  viewing_requested: { label: "Viewing requested", tone: "emerald", description: "The buyer asked for a viewing; not yet confirmed" },
  viewing_scheduled: { label: "Viewing scheduled", tone: "success", description: "An agent confirmed a viewing time" },
  converted: { label: "Converted", tone: "success", description: "The buyer went ahead with a purchase" },
  lost: { label: "Lost", tone: "muted", description: "The enquiry is closed without a sale" },
};

const RANK: Record<LeadStatus, number> = {
  new: 0,
  microsite_generated: 1,
  contacted: 2,
  engaged: 3,
  viewing_requested: 4,
  viewing_scheduled: 5,
  converted: 6,
  lost: 6,
};

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

/** Mirrors public.advance_lead_status: forward only, never out of a terminal state. */
export function advanceStatus(current: LeadStatus, target: LeadStatus): LeadStatus {
  if (current === "converted" || current === "lost") return current;
  return RANK[current] < RANK[target] ? target : current;
}
