"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { signIn } from "@/server/actions/account";

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await signIn({ email: String(data.get("email") ?? ""), password: String(data.get("password") ?? ""), next });
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <Field id="email" label="Work email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10 bg-card" />
      </Field>
      <Field id="password" label="Password" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10 bg-card" />
      </Field>
      {error && (
        <p role="alert" className="rounded-md border border-[#f2cfcc] bg-[#fbeceb] px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Sign in
      </Button>
    </form>
  );
}
