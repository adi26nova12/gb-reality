export const BUYER_EVENT_TYPES = [
  "microsite_opened",
  "property_viewed",
  "property_details_opened",
  "floor_plan_opened",
  "brochure_opened",
  "brochure_page_viewed",
  "brochure_download_requested",
  "brochure_closed",
  "payment_plan_opened",
  "map_opened",
  "whatsapp_clicked",
  "viewing_request_started",
] as const;
export type BuyerEventType = (typeof BUYER_EVENT_TYPES)[number];

export const PROPERTY_EVENT_TYPES: readonly BuyerEventType[] = ["property_viewed", "property_details_opened", "floor_plan_opened"];

export type EventType =
  | BuyerEventType
  | "viewing_request_submitted"
  | "lead_created"
  | "microsite_generated"
  | "microsite_selection_updated"
  | "microsite_revoked"
  | "whatsapp_initiated"
  | "marked_contacted"
  | "lead_status_changed"
  | "viewing_status_changed";

export interface TimelineEvent {
  id: string;
  eventType: EventType;
  actor: "buyer" | "agent" | "system";
  actorName: string | null;
  propertyLabel: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

const humanStatus = (s: unknown) => (typeof s === "string" ? s.replace(/_/g, " ") : "");

/** Neutral, factual descriptions. A page view only means the page was displayed. */
export function describeEvent(e: Pick<TimelineEvent, "eventType" | "propertyLabel" | "metadata" | "actorName">): string {
  const p = e.propertyLabel ? ` — ${e.propertyLabel}` : "";
  const by = e.actorName ? ` by ${e.actorName}` : "";
  switch (e.eventType) {
    case "lead_created":
      return `Enquiry created${by}`;
    case "microsite_generated":
      return `Microsite generated${by}`;
    case "microsite_selection_updated":
      return `Microsite property selection updated${by}`;
    case "microsite_revoked":
      return `Microsite link revoked${by}`;
    case "whatsapp_initiated":
      return `WhatsApp opened with a pre-filled message${by} (sending not confirmed)`;
    case "marked_contacted":
      return `Marked as contacted${by}`;
    case "lead_status_changed":
      return `Status changed from ${humanStatus(e.metadata.from)} to ${humanStatus(e.metadata.to)}${by}`;
    case "viewing_status_changed":
      return `Viewing request ${humanStatus(e.metadata.to)}${by}`;
    case "microsite_opened":
      return "Microsite opened";
    case "property_viewed":
      return `Property card shown on screen${p}`;
    case "property_details_opened":
      return `Property details opened${p}`;
    case "floor_plan_opened":
      return `Floor plan opened${p}`;
    case "brochure_opened":
      return "Brochure opened";
    case "brochure_page_viewed":
      return `Brochure page ${String(e.metadata.page ?? "?")} displayed`;
    case "brochure_download_requested":
      return "Brochure download requested";
    case "brochure_closed":
      return "Brochure viewer closed";
    case "payment_plan_opened":
      return "Payment plan opened";
    case "map_opened":
      return "Location map opened";
    case "whatsapp_clicked":
      return "WhatsApp contact button tapped";
    case "viewing_request_started":
      return "Viewing request form opened";
    case "viewing_request_submitted":
      return `Viewing request submitted${p}`;
  }
}
