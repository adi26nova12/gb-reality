import { describeEvent, type TimelineEvent } from "@/lib/domain/events";
import { formatDateTime, timezoneLabel } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

const ACTOR_STYLE: Record<TimelineEvent["actor"], string> = {
  buyer: "bg-emerald-brand",
  agent: "bg-brass",
  system: "bg-muted-foreground",
};

export function Timeline({ events, timezone }: { events: TimelineEvent[]; timezone: string }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-brand" aria-hidden /> Buyer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brass" aria-hidden /> Team
        </span>
        <span className="ml-auto">Times in {timezoneLabel(timezone)}</span>
      </div>
      <ol className="relative space-y-4 border-l border-border pl-5">
        {events.map((e) => (
          <li key={e.id} className="relative">
            <span className={cn("absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full ring-4 ring-card", ACTOR_STYLE[e.actor])} aria-hidden />
            <div className="text-sm">
              <span className="sr-only">{e.actor === "buyer" ? "Buyer: " : "Team: "}</span>
              {describeEvent(e)}
            </div>
            <time dateTime={e.occurredAt} className="text-xs text-muted-foreground tabular-nums">
              {formatDateTime(e.occurredAt, timezone)}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}
