export const CONFIGURATIONS = [
  "Studio",
  "1BHK",
  "1.5BHK",
  "2BHK",
  "2.5BHK",
  "3BHK",
  "3.5BHK",
  "4BHK",
  "5BHK",
  "Penthouse",
  "Villa",
  "Plot",
  "Other",
] as const;
export type Configuration = (typeof CONFIGURATIONS)[number];

export const PROPERTY_TYPES = ["apartment", "villa", "penthouse", "townhouse", "plot", "other"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  villa: "Villa",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  plot: "Plot",
  other: "Other",
};

export const PROPERTY_AVAILABILITY = ["available", "reserved", "sold", "unavailable"] as const;
export type PropertyAvailability = (typeof PROPERTY_AVAILABILITY)[number];
export const PROPERTY_AVAILABILITY_LABELS: Record<PropertyAvailability, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  unavailable: "Unavailable",
};

export const DEVELOPMENT_AVAILABILITY = ["upcoming", "available", "limited", "sold_out"] as const;
export type DevelopmentAvailability = (typeof DEVELOPMENT_AVAILABILITY)[number];
export const DEVELOPMENT_AVAILABILITY_LABELS: Record<DevelopmentAvailability, string> = {
  upcoming: "Upcoming",
  available: "Selling now",
  limited: "Limited availability",
  sold_out: "Sold out",
};

export const AREA_UNITS = ["sqft", "sqm"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];
export const AREA_UNIT_LABELS: Record<AreaUnit, string> = { sqft: "sq ft", sqm: "m²" };

export const PURCHASE_TIMEFRAMES = [
  "immediate",
  "1_3_months",
  "3_6_months",
  "6_12_months",
  "12_plus_months",
  "undecided",
] as const;
export type PurchaseTimeframe = (typeof PURCHASE_TIMEFRAMES)[number];
export const PURCHASE_TIMEFRAME_LABELS: Record<PurchaseTimeframe, string> = {
  immediate: "Immediately",
  "1_3_months": "1–3 months",
  "3_6_months": "3–6 months",
  "6_12_months": "6–12 months",
  "12_plus_months": "12+ months",
  undecided: "Undecided",
};

export const CONTACT_PREFERENCES = ["whatsapp", "phone", "email"] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
export const CONTACT_PREFERENCE_LABELS: Record<ContactPreference, string> = {
  whatsapp: "WhatsApp",
  phone: "Phone call",
  email: "Email",
};

export const VIEWING_STATUSES = ["requested", "contacted", "confirmed", "rescheduled", "completed", "cancelled"] as const;
export type ViewingStatus = (typeof VIEWING_STATUSES)[number];
export const VIEWING_STATUS_LABELS: Record<ViewingStatus, string> = {
  requested: "Requested",
  contacted: "Buyer contacted",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TIME_RANGES = ["morning", "afternoon", "evening"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];
export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  morning: "Morning (9am – 12pm)",
  afternoon: "Afternoon (12pm – 4pm)",
  evening: "Evening (4pm – 7pm)",
};

export const MICROSITE_EXPIRY_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "never", label: "No expiry" },
] as const;

export const MAX_MICROSITE_PROPERTIES = 12;

export const MEDIA_BUCKET = "property-media";
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BROCHURE_BYTES = 25 * 1024 * 1024;
