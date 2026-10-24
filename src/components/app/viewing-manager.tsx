"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageCircle, Phone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/app/field";
import { VIEWING_STATUSES, VIEWING_STATUS_LABELS, TIME_RANGE_LABELS, type TimeRange, type ViewingStatus } from "@/lib/domain/constants";
import { formatCalendarDate, timezoneLabel, utcToZonedLocal } from "@/lib/domain/dates";
import { formatPhone, phoneDigits } from "@/lib/domain/phone";
import { updateViewingRequest } from "@/server/actions/account";
import type { ViewingRequest } from "@/lib/types";

const DEFAULT_HOUR: Record<string, string> = { morning: "10:00", afternoon: "14:00", evening: "17:00" };

export function ViewingManager({ request, timezone, trigger }: { request: ViewingRequest; timezone: string; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<ViewingStatus>(request.status as ViewingStatus);
  const [when, setWhen] = useState(
    request.scheduledFor ? utcToZonedLocal(request.scheduledFor, timezone) : `${request.preferredDate}T${DEFAULT_HOUR[request.preferredTimeRange] ?? "11:00"}`,
  );
  const [notes, setNotes] = useState(request.agentNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const needsTime = status === "confirmed" || status === "rescheduled";

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await updateViewingRequest({ requestId: request.id, status, scheduledFor: needsTime ? when : undefined, agentNotes: notes });
      if (!result.ok) {
        setError(result.fieldErrors?.scheduledFor ?? result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setOpen(false);
      router.refresh();
    });

  const waText = encodeURIComponent(`Hi ${request.name.split(" ")[0]}, thank you for your viewing request for ${formatCalendarDate(request.preferredDate)}.`);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline" size="sm">Manage</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Viewing request from {request.name}</DialogTitle>
          <DialogDescription>
            Asked for {formatCalendarDate(request.preferredDate)}, {TIME_RANGE_LABELS[request.preferredTimeRange as TimeRange] ?? request.preferredTimeRange}
            {request.propertyLabel ? ` · ${request.propertyLabel}` : ""}. The buyer has been told the team will confirm.
          </DialogDescription>
        </DialogHeader>
        {request.message && <blockquote className="rounded-lg border-l-2 border-brass bg-muted/50 px-3 py-2 text-sm">{request.message}</blockquote>}
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${request.phone}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Phone aria-hidden /> {formatPhone(request.phone)}
          </a>
          <a href={`https://wa.me/${phoneDigits(request.phone)}?text=${waText}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`status-${request.id}`} label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as ViewingStatus)}>
              <SelectTrigger id={`status-${request.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEWING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {VIEWING_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {needsTime && (
            <Field id={`when-${request.id}`} label="Confirmed date and time" hint={timezoneLabel(timezone)} required>
              <Input id={`when-${request.id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          )}
          <Field id={`notes-${request.id}`} label="Internal notes" className="sm:col-span-2">
            <Textarea id={`notes-${request.id}`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
