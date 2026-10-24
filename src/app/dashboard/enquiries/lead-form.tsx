"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection, inputErrorProps } from "@/components/app/field";
import { leadSchema, type LeadInput, type LeadValues } from "@/lib/validation/schemas";
import {
  CONFIGURATIONS,
  CONTACT_PREFERENCES,
  CONTACT_PREFERENCE_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PURCHASE_TIMEFRAMES,
  PURCHASE_TIMEFRAME_LABELS,
} from "@/lib/domain/constants";
import { formatCompactPrice, parseIndianAmount } from "@/lib/domain/money";
import { normalisePhone } from "@/lib/domain/phone";
import { createLead, updateLead } from "@/server/actions/leads";

function AmountPreview({ value }: { value: string | number | undefined }) {
  const n = parseIndianAmount(value ?? null);
  if (n === null || Number.isNaN(n)) return null;
  return <>= {formatCompactPrice(n)}</>;
}

export function LeadForm({
  mode,
  leadId,
  defaults,
  developments,
  agents,
  currentUserId,
}: {
  mode: "create" | "edit";
  leadId?: string;
  defaults?: Partial<LeadInput>;
  developments: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<LeadInput, unknown, LeadValues>({
    resolver: zodResolver(leadSchema),
    mode: "onTouched",
    defaultValues: {
      buyerName: "",
      phone: "",
      developmentId: developments.length === 1 ? developments[0].id : "",
      configuration: undefined,
      email: "",
      budgetMin: "",
      budgetMax: "",
      preferredLocation: "",
      bedrooms: "",
      preferredFloor: "",
      propertyType: "none",
      purchaseTimeframe: "none",
      assignedAgentId: currentUserId,
      notes: "",
      contactPreference: "whatsapp",
      ...defaults,
    },
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const err = (name: keyof LeadInput) => errors[name]?.message as string | undefined;
  const [phone, budgetMin, budgetMax] = useWatch({ control, name: ["phone", "budgetMin", "budgetMax"] });
  const phonePreview = phone ? normalisePhone(String(phone)) : null;

  const onSubmit = form.handleSubmit(() => {
    // Send the raw values; the server validates them again with the same schema.
    const raw = form.getValues();
    startTransition(async () => {
      const result = mode === "create" ? await createLead(raw) : await updateLead(leadId!, raw);
      if (!result.ok) {
        toast.error(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof LeadInput, { message });
        }
        return;
      }
      toast.success(result.message ?? "Saved");
      router.push(mode === "create" ? `/dashboard/enquiries/${result.data.id}/microsite` : `/dashboard/enquiries/${result.data.id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-xl border border-border bg-card px-6 py-8 sm:px-8">
      <FormSection title="Buyer" description="WhatsApp is the primary contact, so email is optional.">
        <Field id="buyerName" label="Buyer name" required error={err("buyerName")}>
          <Input id="buyerName" autoComplete="off" autoFocus={mode === "create"} {...register("buyerName")} {...inputErrorProps("buyerName", err("buyerName"))} />
        </Field>
        <Field
          id="phone"
          label="Mobile / WhatsApp number"
          required
          error={err("phone")}
          hint={phonePreview?.ok ? `Will be saved as ${phonePreview.international}` : "Include the country code. Numbers without one are treated as Indian (+91)."}
        >
          <Input id="phone" type="tel" inputMode="tel" placeholder="+91 98123 45678" autoComplete="off" {...register("phone")} {...inputErrorProps("phone", err("phone"))} />
        </Field>
        <Field id="email" label="Email" error={err("email")}>
          <Input id="email" type="email" autoComplete="off" {...register("email")} {...inputErrorProps("email", err("email"))} />
        </Field>
        <Field id="contactPreference" label="Contact preference" error={err("contactPreference")}>
          <Controller
            control={control}
            name="contactPreference"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="contactPreference" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_PREFERENCES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CONTACT_PREFERENCE_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FormSection>

      <FormSection title="Requirement" description="Used to match properties from your catalogue.">
        <Field id="developmentId" label="Development" required error={err("developmentId")}>
          <Controller
            control={control}
            name="developmentId"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="developmentId" className="w-full" aria-invalid={Boolean(err("developmentId"))}>
                  <SelectValue placeholder={developments.length ? "Choose a development" : "No developments yet"} />
                </SelectTrigger>
                <SelectContent>
                  {developments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="configuration" label="Preferred configuration" required error={err("configuration")}>
          <Controller
            control={control}
            name="configuration"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="configuration" className="w-full" aria-invalid={Boolean(err("configuration"))}>
                  <SelectValue placeholder="e.g. 2BHK" />
                </SelectTrigger>
                <SelectContent>
                  {CONFIGURATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="budgetMin" label="Budget minimum" error={err("budgetMin")} hint={<AmountPreview value={budgetMin} />}>
          <Input id="budgetMin" placeholder="e.g. 80L" {...register("budgetMin")} {...inputErrorProps("budgetMin", err("budgetMin"))} />
        </Field>
        <Field id="budgetMax" label="Budget maximum" error={err("budgetMax")} hint={<AmountPreview value={budgetMax} />}>
          <Input id="budgetMax" placeholder="e.g. 1Cr" {...register("budgetMax")} {...inputErrorProps("budgetMax", err("budgetMax"))} />
        </Field>
        <Field id="propertyType" label="Property type" error={err("propertyType")}>
          <Controller
            control={control}
            name="propertyType"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={field.onChange}>
                <SelectTrigger id="propertyType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PROPERTY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="bedrooms" label="Bedrooms" error={err("bedrooms")}>
          <Input id="bedrooms" inputMode="numeric" {...register("bedrooms")} {...inputErrorProps("bedrooms", err("bedrooms"))} />
        </Field>
        <Field id="preferredLocation" label="Preferred location or building" error={err("preferredLocation")}>
          <Input id="preferredLocation" {...register("preferredLocation")} />
        </Field>
        <Field id="preferredFloor" label="Preferred floor" error={err("preferredFloor")}>
          <Input id="preferredFloor" placeholder="e.g. 10th or above" {...register("preferredFloor")} />
        </Field>
        <Field id="purchaseTimeframe" label="Purchase timeframe" error={err("purchaseTimeframe")}>
          <Controller
            control={control}
            name="purchaseTimeframe"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={field.onChange}>
                <SelectTrigger id="purchaseTimeframe" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {PURCHASE_TIMEFRAMES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PURCHASE_TIMEFRAME_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FormSection>

      <FormSection title="Handling" description="Notes are private to your team and never shown on the microsite.">
        <Field id="assignedAgentId" label="Assigned agent" error={err("assignedAgentId")}>
          <Controller
            control={control}
            name="assignedAgentId"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={field.onChange}>
                <SelectTrigger id="assignedAgentId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="notes" label="Additional notes" error={err("notes")} className="sm:col-span-2">
          <Textarea id="notes" rows={4} {...register("notes")} />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {mode === "create" ? "Save and match properties" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
