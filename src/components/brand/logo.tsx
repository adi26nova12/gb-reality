import { cn } from "@/lib/utils";

/** Clannco wordmark: a brass keystone mark and a serif name. */
export function Logo({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 28 28" aria-hidden="true" className="size-7 shrink-0">
        <rect x="1" y="1" width="26" height="26" rx="7" fill="none" stroke="var(--brass)" strokeWidth="1.2" />
        <path d="M9 19.5V12.2L14 8l5 4.2v7.3" fill="none" stroke="var(--brass)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M12.3 19.5v-4.2h3.4v4.2" fill="none" stroke="var(--sidebar-primary)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span
        className={cn(
          "font-display text-[1.45rem] leading-none font-semibold tracking-wide",
          tone === "light" ? "text-[#f3efe6]" : "text-charcoal",
        )}
      >
        Clannco
      </span>
    </span>
  );
}
