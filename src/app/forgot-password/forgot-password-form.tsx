"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { requestPasswordReset } from "@/server/actions/password";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await requestPasswordReset(email);
          setMessage(r.ok ? { ok: true, text: r.message ?? "Check your email." } : { ok: false, text: r.error });
        });
      }}
    >
      <Field id="email" label="Work email" required>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 bg-card" />
      </Field>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-emerald-brand" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending || !email}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Send reset link
      </Button>
    </form>
  );
}
