"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_STATUSES, LEAD_STATUS_META, type LeadStatus } from "@/lib/domain/lead-status";
import { setLeadStatus } from "@/server/actions/leads";

export function StatusControl({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<LeadStatus>(status);
  const [pending, startTransition] = useTransition();
  const changed = value !== status;

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={(v) => setValue(v as LeadStatus)}>
        <SelectTrigger className="w-full" aria-label="Enquiry status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {LEAD_STATUS_META[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{LEAD_STATUS_META[value].description}.</p>
      {changed && (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setLeadStatus(leadId, value);
              if (!result.ok) {
                toast.error(result.error);
                setValue(status);
                return;
              }
              toast.success(result.message ?? "Status updated");
              router.refresh();
            })
          }
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save status
        </Button>
      )}
    </div>
  );
}
