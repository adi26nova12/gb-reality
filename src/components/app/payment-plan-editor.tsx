"use client";

import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared by the development and property forms, whose value types differ;
// both have a `paymentPlan` array of { label, value }.
export function PaymentPlanEditor({
  control,
  register,
  errors,
}: {
  control: Control<any, any, any>;
  register: UseFormRegister<any>;
  errors?: FieldErrors<any>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "paymentPlan" });
  const reg = register;
  const errs = (errors as any)?.paymentPlan;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="space-y-2">
      {fields.length === 0 && <p className="text-xs text-muted-foreground">No milestones yet.</p>}
      {fields.map((f, i) => (
        <div key={f.id} className="flex items-start gap-2">
          <div className="flex-1">
            <Input placeholder="Milestone, e.g. On booking" aria-label={`Milestone ${i + 1}`} {...reg(`paymentPlan.${i}.label`)} />
            {errs?.[i]?.label && <p className="mt-1 text-xs text-destructive">{errs[i].label.message}</p>}
          </div>
          <div className="w-36">
            <Input placeholder="10%" aria-label={`Milestone ${i + 1} amount`} {...reg(`paymentPlan.${i}.value`)} />
            {errs?.[i]?.value && <p className="mt-1 text-xs text-destructive">{errs[i].value.message}</p>}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label={`Remove milestone ${i + 1}`}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => append({ label: "", value: "" })} disabled={fields.length >= 20}>
        <Plus aria-hidden /> Add milestone
      </Button>
    </div>
  );
}
