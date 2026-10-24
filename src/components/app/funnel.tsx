export function Funnel({ steps, note }: { steps: { label: string; value: number }[]; note?: string }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div>
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const pct = Math.round((s.value / top) * 100);
          return (
            <li key={s.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="tabular-nums">
                  <span className="font-semibold text-foreground">{s.value}</span>
                  {i > 0 && <span className="ml-1.5 text-muted-foreground">{pct}%</span>}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-emerald-brand transition-[width]" style={{ width: `${Math.max(pct, s.value > 0 ? 3 : 0)}%`, opacity: 1 - i * 0.1 }} />
              </div>
            </li>
          );
        })}
      </ol>
      {note && <p className="mt-4 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
