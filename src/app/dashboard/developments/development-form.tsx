"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection, inputErrorProps } from "@/components/app/field";
import { MediaUploader } from "@/components/app/media-uploader";
import { PaymentPlanEditor } from "@/components/app/payment-plan-editor";
import { developmentSchema, type DevelopmentInput, type DevelopmentValues } from "@/lib/validation/schemas";
import { DEVELOPMENT_AVAILABILITY, DEVELOPMENT_AVAILABILITY_LABELS } from "@/lib/domain/constants";
import { saveDevelopment } from "@/server/actions/catalogue";

export function DevelopmentForm({ id, defaults, mediaPrefix }: { id?: string; defaults?: Partial<DevelopmentInput>; mediaPrefix: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<DevelopmentInput, unknown, DevelopmentValues>({
    resolver: zodResolver(developmentSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      developerName: "",
      description: "",
      location: "",
      address: "",
      mapUrl: "",
      latitude: "",
      longitude: "",
      amenities: "",
      paymentPlan: [],
      paymentPlanNotes: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      availabilityStatus: "available",
      coverImagePath: "",
      coverImageMobilePath: "",
      galleryPaths: [],
      ...defaults,
    },
  });
  const { register, control, formState } = form;
  const err = (name: keyof DevelopmentInput) => formState.errors[name]?.message as string | undefined;

  const onSubmit = form.handleSubmit(() => {
    const raw = form.getValues();
    startTransition(async () => {
      const result = await saveDevelopment(id ?? null, raw);
      if (!result.ok) {
        toast.error(result.error);
        for (const [f, m] of Object.entries(result.fieldErrors ?? {})) form.setError(f as keyof DevelopmentInput, { message: m });
        return;
      }
      toast.success(result.message ?? "Saved");
      router.push(`/dashboard/developments/${result.data.id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-xl border border-border bg-card px-6 py-8 sm:px-8">
      <FormSection title="Development" description="Shown at the top of every buyer's microsite.">
        <Field id="name" label="Development name" required error={err("name")}>
          <Input id="name" {...register("name")} {...inputErrorProps("name", err("name"))} />
        </Field>
        <Field id="developerName" label="Developer or builder" error={err("developerName")}>
          <Input id="developerName" {...register("developerName")} />
        </Field>
        <Field id="availabilityStatus" label="Availability" error={err("availabilityStatus")}>
          <Controller
            control={control}
            name="availabilityStatus"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="availabilityStatus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVELOPMENT_AVAILABILITY.map((s) => (
                    <SelectItem key={s} value={s}>
                      {DEVELOPMENT_AVAILABILITY_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="description" label="Description" error={err("description")} className="sm:col-span-2">
          <Textarea id="description" rows={5} {...register("description")} />
        </Field>
        <Field id="amenities" label="Amenities" hint="One per line or comma-separated" error={err("amenities")} className="sm:col-span-2">
          <Textarea id="amenities" rows={3} placeholder={"Clubhouse\nSwimming pool\nCo-working lounge"} {...register("amenities")} />
        </Field>
      </FormSection>

      <FormSection title="Location" description="Buyers can open the map from their microsite.">
        <Field id="location" label="Area / city" error={err("location")}>
          <Input id="location" placeholder="e.g. Baner, Pune" {...register("location")} />
        </Field>
        <Field id="address" label="Address" error={err("address")}>
          <Input id="address" {...register("address")} />
        </Field>
        <Field id="mapUrl" label="Map link" hint="A Google Maps share link (https://…)" error={err("mapUrl")} className="sm:col-span-2">
          <Input id="mapUrl" type="url" {...register("mapUrl")} {...inputErrorProps("mapUrl", err("mapUrl"))} />
        </Field>
        <Field id="latitude" label="Latitude" error={err("latitude")}>
          <Input id="latitude" inputMode="decimal" {...register("latitude")} />
        </Field>
        <Field id="longitude" label="Longitude" error={err("longitude")}>
          <Input id="longitude" inputMode="decimal" {...register("longitude")} />
        </Field>
      </FormSection>

      <FormSection title="Payment plan" description="Used for every property unless the property has its own plan.">
        <div className="sm:col-span-2">
          <PaymentPlanEditor control={control as never} register={register as never} errors={formState.errors} />
        </div>
        <Field id="paymentPlanNotes" label="Payment plan notes" error={err("paymentPlanNotes")} className="sm:col-span-2">
          <Textarea id="paymentPlanNotes" rows={2} placeholder="e.g. Construction-linked plan. GST and registration extra." {...register("paymentPlanNotes")} />
        </Field>
      </FormSection>

      <FormSection title="Sales contact" description="Fallback contact on microsites when the assigned agent has no phone number.">
        <Field id="contactName" label="Name" error={err("contactName")}>
          <Input id="contactName" {...register("contactName")} />
        </Field>
        <Field id="contactPhone" label="Phone / WhatsApp" error={err("contactPhone")}>
          <Input id="contactPhone" type="tel" {...register("contactPhone")} {...inputErrorProps("contactPhone", err("contactPhone"))} />
        </Field>
        <Field id="contactEmail" label="Email" error={err("contactEmail")}>
          <Input id="contactEmail" type="email" {...register("contactEmail")} {...inputErrorProps("contactEmail", err("contactEmail"))} />
        </Field>
      </FormSection>

      <FormSection
        title="Imagery"
        description="The cover is the backdrop for each buyer's personalised welcome: their name is set over it. Leave calm sky or space on the left (wide) and at the bottom (portrait)."
      >
        <Field id="cover" label="Cover image, wide (desktop, 16:9)" className="sm:col-span-2">
          <Controller
            control={control}
            name="coverImagePath"
            render={({ field }) => (
              <MediaUploader kind="images" mediaPrefix={mediaPrefix} value={field.value ? [field.value] : []} onChange={(p) => field.onChange(p[0] ?? "")} label="Upload cover image" />
            )}
          />
        </Field>
        <Field id="coverMobile" label="Cover image, portrait (phones, 9:16)" hint="Optional. Phones use the wide image if this is empty." className="sm:col-span-2">
          <Controller
            control={control}
            name="coverImageMobilePath"
            render={({ field }) => (
              <MediaUploader kind="images" mediaPrefix={mediaPrefix} value={field.value ? [field.value] : []} onChange={(p) => field.onChange(p[0] ?? "")} label="Upload portrait cover" />
            )}
          />
        </Field>
        <Field id="gallery" label="Gallery" className="sm:col-span-2">
          <Controller
            control={control}
            name="galleryPaths"
            render={({ field }) => <MediaUploader kind="images" multiple mediaPrefix={mediaPrefix} value={field.value ?? []} onChange={field.onChange} label="Upload gallery images" />}
          />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {id ? "Save changes" : "Create development"}
        </Button>
      </div>
    </form>
  );
}
