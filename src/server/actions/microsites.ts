"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionAuth } from "@/server/auth";
import { check, fail, ok, toActionError, type ActionResult } from "@/server/action-result";
import { siteUrl } from "@/server/url";
import { encryptToken, generateMicrositeToken, hashToken } from "@/lib/security/tokens";
import { micrositeSelectionSchema, type MicrositeSelectionInput } from "@/lib/validation/schemas";

export async function generateMicrosite(input: MicrositeSelectionInput): Promise<ActionResult<{ micrositeId: string; url: string }>> {
  try {
    const ctx = await requireActionAuth();
    const v = micrositeSelectionSchema.parse(input);

    const token = generateMicrositeToken();
    const ciphertext = encryptToken(token, process.env.MICROSITE_TOKEN_SECRET);
    const expiresAt = v.expiry === "never" ? null : new Date(Date.now() + Number(v.expiry) * 86_400_000).toISOString();

    const micrositeId = check(
      await ctx.supabase.rpc("create_microsite", {
        p_lead_id: v.leadId,
        p_token_hash: hashToken(token),
        p_token_ciphertext: ciphertext,
        p_property_ids: v.propertyIds,
        p_match_tiers: v.matchTiers,
        p_expires_at: expiresAt,
        p_intro_message: v.introMessage,
        p_show_buyer_name: v.showBuyerName,
      }),
    ) as string;

    revalidatePath("/dashboard", "layout");
    return ok({ micrositeId, url: `${await siteUrl()}/p/${token}` }, "Personalised microsite generated");
  } catch (error) {
    return toActionError(error, "generateMicrosite");
  }
}

export async function updateMicrositeSelection(
  micrositeId: string,
  propertyIds: string[],
  matchTiers: Record<string, "exact" | "close" | "other" | "manual">,
): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const v = z
      .object({
        micrositeId: z.uuid(),
        propertyIds: micrositeSelectionSchema.shape.propertyIds,
        matchTiers: micrositeSelectionSchema.shape.matchTiers,
      })
      .parse({ micrositeId, propertyIds, matchTiers });
    check(
      await ctx.supabase.rpc("update_microsite_selection", {
        p_microsite_id: v.micrositeId,
        p_property_ids: v.propertyIds,
        p_match_tiers: v.matchTiers,
      }),
    );
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Microsite updated. The same link now shows the new selection.");
  } catch (error) {
    return toActionError(error, "updateMicrositeSelection");
  }
}

export async function revokeMicrosite(micrositeId: string): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    check(await ctx.supabase.rpc("revoke_microsite", { p_microsite_id: z.uuid().parse(micrositeId) }));
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Link revoked. The buyer will now see an expired-link page.");
  } catch (error) {
    return toActionError(error, "revokeMicrosite");
  }
}

export async function extendMicrosite(micrositeId: string, days: number): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const id = z.uuid().parse(micrositeId);
    const d = z.number().int().min(1).max(365).parse(days);
    const updated = check(
      await ctx.supabase
        .from("microsites")
        .update({ expires_at: new Date(Date.now() + d * 86_400_000).toISOString() })
        .eq("organisation_id", ctx.organisation.id)
        .eq("id", id)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle(),
    );
    if (!updated) return fail("Only active or expired links can be extended. Revoked links cannot be reopened.");
    revalidatePath("/dashboard", "layout");
    return ok(undefined, `Link now expires in ${d} days`);
  } catch (error) {
    return toActionError(error, "extendMicrosite");
  }
}

/** Logged when the agent opens wa.me. This does not mean a message was sent. */
export async function recordWhatsAppInitiated(micrositeId: string): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    check(await ctx.supabase.rpc("record_whatsapp_initiated", { p_microsite_id: z.uuid().parse(micrositeId) }));
    revalidatePath("/dashboard", "layout");
    return ok(undefined);
  } catch (error) {
    return toActionError(error, "recordWhatsAppInitiated");
  }
}
