import Link from "next/link";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

export function RangeTabs({ value, basePath }: { value: RangeKey; basePath: string }) {
  return (
    <div role="tablist" aria-label="Date range" className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {RANGE_OPTIONS.map((o) => (
        <Link
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          href={o.value === "30d" ? basePath : `${basePath}?range=${o.value}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            o.value === value ? "bg-charcoal text-ivory" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label.replace("Last ", "")}
        </Link>
      ))}
    </div>
  );
}
