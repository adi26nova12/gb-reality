"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterSelect {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}

/** Search box and select filters that live in the URL, so views are shareable and survive refresh. */
export function FilterBar({ searchPlaceholder, selects = [] }: { searchPlaceholder?: string; selects?: FilterSelect[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = selects.some((s) => params.get(s.name)) || Boolean(params.get("q"));

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {searchPlaceholder && (
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 bg-card pl-8"
          />
        </div>
      )}
      {selects.map((s) => (
        <Select key={s.name} value={params.get(s.name) ?? "all"} onValueChange={(v) => update({ [s.name]: v === "all" ? null : v })}>
          <SelectTrigger className="h-9 min-w-40 bg-card" aria-label={s.label}>
            <SelectValue placeholder={s.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{s.allLabel ?? `All ${s.label.toLowerCase()}`}</SelectItem>
            {s.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            update(Object.fromEntries([...selects.map((s) => [s.name, null]), ["q", null]]));
          }}
        >
          <X aria-hidden /> Clear
        </Button>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating results" />}
    </div>
  );
}
