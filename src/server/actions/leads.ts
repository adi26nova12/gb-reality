"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionAuth } from "@/server/auth";
import { check, fail, ok, required, toActionError, type ActionResult } from "@/server/action-result";
import { leadSchema, leadStatusSchema, type LeadInput, type LeadValues } from "@/lib/validation/schemas";

function toRow(v: LeadValues) {
  return {
    buyer_name: v.buyerName,
    phone_e164: v.phone,
    development_id: v.developmentId,
    configuration: v.configuration,
    email: v.email,
    budget_min: v.budgetMin,
    budget_max: v.budgetMax,
    preferred_location: v.preferredLocation,
    bedrooms: v.bedrooms,
    preferred_floor: v.preferredFloor,
    property_type: v.propertyType,
    purchase_timeframe: v.purchaseTimeframe,
    assigned_agent_id: v.assignedAgentId,
    notes: v.notes,
    contact_preference: v.contactPreference,
  };
}

export async function createLead(input: LeadInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireActionAuth();
    const parsed = leadSchema.safeParse(input);
    if (!parsed.success) throw parsed.error;
    const v = parsed.data;

    const development = check(
      await ctx.supabase.from("developments").select("id").eq("organisation_id", ctx.organisation.id).eq("id", v.developmentId).is("archived_at", null).maybeSingle(),
    );
    if (!development) return fail("Please correct the highlighted fields.", { developmentId: "Choose an active development" });

    const row = required(
      await ctx.supabase
        .from("leads")
        .insert({
          ...toRow(v),
          organisation_id: ctx.organisation.id,
          budget_currency: ctx.organisation.defaultCurrency,
          assigned_agent_id: v.assignedAgentId ?? ctx.userId,
          created_by: ctx.userId,
        })
        .select("id")
        .single(),
    );
    revalidatePath("/dashboard", "layout");
    return ok({ id: row.id as string }, "Enquiry saved");
  } catch (error) {
    return toActionError(error, "createLead");
  }
}

export async function updateLead(leadId: string, input: LeadInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireActionAuth();
    const id = z.uuid().parse(leadId);
    const parsed = leadSchema.safeParse(input);
    if (!parsed.success) throw parsed.error;

    const updated = check(
      await ctx.supabase
        .from("leads")
        .update(toRow(parsed.data))
        .eq("organisation_id", ctx.organisation.id)
        .eq("id", id)
        .select("id")
        .maybeSingle(),
    );
    if (!updated) return fail("That enquiry could not be found.");
    revalidatePath("/dashboard", "layout");
    return ok({ id }, "Enquiry updated");
  } catch (error) {
    return toActionError(error, "updateLead");
  }
}

export async function setLeadStatus(leadId: string, status: string): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const v = leadStatusSchema.parse({ leadId, status });
    check(await ctx.supabase.rpc("set_lead_status", { p_lead_id: v.leadId, p_status: v.status }));
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Status updated");
  } catch (error) {
    return toActionError(error, "setLeadStatus");
  }
}

export async function markLeadContacted(leadId: string): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    check(await ctx.supabase.rpc("mark_lead_contacted", { p_lead_id: z.uuid().parse(leadId) }));
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Marked as contacted");
  } catch (error) {
    return toActionError(error, "markLeadContacted");
  }
}

export async function setLeadArchived(leadId: string, archived: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const id = z.uuid().parse(leadId);
    const updated = check(
      await ctx.supabase
        .from("leads")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("organisation_id", ctx.organisation.id)
        .eq("id", id)
        .select("id")
        .maybeSingle(),
    );
    if (!updated) return fail("That enquiry could not be found.");
    revalidatePath("/dashboard", "layout");
    return ok(undefined, archived ? "Enquiry archived. Its microsite link no longer shows any content." : "Enquiry restored");
  } catch (error) {
    return toActionError(error, "setLeadArchived");
  }
}
