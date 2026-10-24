"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { setPassword } from "@/server/actions/password";

export function SetPasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setErrors({});
        setFormError(null);
        startTransition(async () => {
          const r = await setPassword({ password: String(data.get("password") ?? ""), confirm: String(data.get("confirm") ?? "") });
          if (r && !r.ok) {
            setErrors(r.fieldErrors ?? {});
            if (!r.fieldErrors) setFormError(r.error);
          }
        });
      }}
    >
      <Field id="password" label="New password" required error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className="h-10 bg-card" />
      </Field>
      <Field id="confirm" label="Confirm password" required error={errors.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-10 bg-card" />
      </Field>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Save password and continue
      </Button>
    </form>
  );
}
