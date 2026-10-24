import { normalisePhone, phoneDigits } from "./phone";

export interface WhatsAppMessageInput {
  buyerName: string;
  developmentName: string;
  configuration: string;
  micrositeUrl: string;
  agentName?: string | null;
  organisationName?: string | null;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function buildWhatsAppMessage(input: WhatsAppMessageInput): string {
  const name = firstName(input.buyerName);
  const greeting = name ? `Hi ${name},` : "Hello,";
  const signature = [input.agentName?.trim(), input.developmentName.trim()].filter(Boolean).join("\n");

  return [
    `${greeting} thank you for your interest in ${input.developmentName}.`,
    "",
    `I've put together a personalised selection of available ${input.configuration} homes based on your preferences, including floor plans, pricing, and payment information.`,
    "",
    "You can explore your selection here:",
    input.micrositeUrl,
    "",
    "If you'd like, you can also request a viewing directly through the page.",
    "",
    "Best regards,",
    signature,
  ].join("\n");
}

/**
 * Builds a click-to-chat link: https://wa.me/<digits>?text=<encoded>.
 * Opening it does NOT send anything; the agent still has to press Send.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalised = normalisePhone(phone);
  if (!normalised.ok) throw new Error(`Cannot build a WhatsApp link: ${normalised.error}`);
  return `https://wa.me/${phoneDigits(normalised.e164)}?text=${encodeURIComponent(message)}`;
}
