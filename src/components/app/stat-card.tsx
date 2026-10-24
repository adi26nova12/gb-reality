import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  emphasis = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-colors",
        emphasis ? "border-charcoal bg-charcoal text-ivory" : "border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs font-medium", emphasis ? "text-champagne/80" : "text-muted-foreground")}>{label}</span>
        {Icon && <Icon className={cn("size-4", emphasis ? "text-brass" : "text-muted-foreground/70")} aria-hidden />}
      </div>
      <div className="mt-3 font-display text-[2.1rem] leading-none font-semibold tabular-nums">{value}</div>
      {hint && <div className={cn("mt-2 text-xs", emphasis ? "text-[#a8a397]" : "text-muted-foreground")}>{hint}</div>}
    </div>
  );
}
