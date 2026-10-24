import "server-only";
import { ZodError } from "zod";
import { ActionAuthError } from "./auth";
import { TokenSecretError } from "@/lib/security/tokens";
import { fieldErrors } from "@/lib/validation/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, errors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors: errors };
}

// Error codes raised by our SQL functions, mapped to agent-friendly text.
const KNOWN_DB_ERRORS: Record<string, string> = {
  lead_not_found: "That enquiry could not be found.",
  lead_archived: "This enquiry is archived. Restore it before generating a microsite.",
  no_properties_selected: "Select at least one property.",
  too_many_properties: "Select up to 12 properties.",
  invalid_property_selection: "One or more selected properties are no longer available. Refresh and review the selection.",
  invalid_expiry: "The expiry date must be in the future.",
  microsite_not_found: "That microsite could not be found.",
  microsite_revoked: "This microsite link has been revoked. Generate a new one instead.",
  invalid_status: "That status is not recognised.",
  scheduled_time_required: "Choose the confirmed date and time.",
  viewing_request_not_found: "That viewing request could not be found.",
  not_authenticated: "Your session has expired. Please sign in again.",
};

/**
 * Converts any thrown error into a safe ActionResult. Database details are
 * logged on the server (without request data) and never sent to the browser.
 */
export function toActionError(error: unknown, context: string): ActionResult<never> {
  if (error instanceof ActionAuthError) return fail(error.message);
  if (error instanceof ZodError) return fail("Please correct the highlighted fields.", fieldErrors(error));
  if (error instanceof TokenSecretError) {
    console.error(`[${context}] token secret misconfigured`);
    return fail("Microsite links cannot be generated until MICROSITE_TOKEN_SECRET is configured on the server.");
  }
  const message = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  const known = Object.keys(KNOWN_DB_ERRORS).find((k) => message.includes(k));
  if (known) return fail(KNOWN_DB_ERRORS[known]);
  if (code === "23505") return fail("A record with these details already exists.");
  if (code === "42501") return fail("You do not have permission to do that.");
  if (code === "23503") return fail("This record is linked to other records and cannot be changed that way.");
  console.error(`[${context}] failed`, { code, message });
  return fail("Something went wrong while saving. Please try again.");
}

/** Throws the Supabase error so toActionError can classify it. */
export function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

/** Like check(), for queries that must return a row (e.g. insert ... .single()). */
export function required<R extends { data: unknown; error: unknown }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error("Expected a row but none was returned");
  return result.data as NonNullable<R["data"]>;
}
