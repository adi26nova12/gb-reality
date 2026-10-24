"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/app/field";
import { updateNotificationPreferences, updateProfile } from "@/server/actions/account";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [tel, setTel] = useState(phone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateProfile({ fullName: name, phone: tel });
          setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message ?? "Saved");
          router.refresh();
        });
      }}
    >
      <Field id="fullName" label="Your name" hint="Used to sign WhatsApp messages and shown on microsites" error={errors.fullName} required>
        <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="agentPhone" label="Your WhatsApp number" hint="Buyers use this to contact you from their microsite" error={errors.phone}>
        <Input id="agentPhone" type="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+91 98123 45678" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save profile
        </Button>
      </div>
    </form>
  );
}

const PREFS = [
  { key: "notifyFirstOpen", label: "A buyer opens their microsite for the first time" },
  { key: "notifyViewingRequest", label: "A buyer requests a viewing" },
  { key: "notifyContactRequest", label: "A buyer taps the WhatsApp contact button (at most every 6 hours per buyer)" },
  { key: "notifyEngagement", label: "Other activity such as floor plan or brochure opens (at most hourly per buyer)" },
  { key: "notifyEmail", label: "Also email me these notifications" },
] as const;

type Prefs = Record<(typeof PREFS)[number]["key"], boolean>;

export function NotificationPreferences({ initial, emailAvailable }: { initial: Prefs; emailAvailable: boolean }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    startTransition(async () => {
      const r = await updateNotificationPreferences(next);
      if (!r.ok) {
        toast.error(r.error);
        setPrefs(prefs);
      } else toast.success("Preferences saved");
    });
  };

  return (
    <ul className="space-y-4">
      {PREFS.map((p) => (
        <li key={p.key} className="flex items-center justify-between gap-6">
          <label htmlFor={p.key} className="text-sm">
            {p.label}
            {p.key === "notifyEmail" && !emailAvailable && <span className="block text-xs text-muted-foreground">Email delivery is not configured on this deployment.</span>}
          </label>
          <Switch
            id={p.key}
            checked={prefs[p.key]}
            disabled={pending || (p.key === "notifyEmail" && !emailAvailable && !prefs.notifyEmail)}
            onCheckedChange={(v) => toggle(p.key, v)}
          />
        </li>
      ))}
    </ul>
  );
}
