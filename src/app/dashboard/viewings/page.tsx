import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination } from "@/components/app/pagination";
import { ViewingStatusBadge } from "@/components/app/status-badges";
import { ViewingManager } from "@/components/app/viewing-manager";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAuth } from "@/server/auth";
import { listViewingRequests } from "@/server/data/viewings";
import { TIME_RANGE_LABELS, type TimeRange } from "@/lib/domain/constants";
import { formatCalendarDate, formatDateTime, relativeTime, timezoneLabel } from "@/lib/domain/dates";
import { formatPhone } from "@/lib/domain/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Viewing requests" };

const VIEWS = [
  { value: "open", label: "Needs action" },
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
];

export default async function ViewingsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.value === sp.view) ? sp.view! : "open";
  const result = await listViewingRequests(ctx, { view, page: Number(sp.page) || 1 });
  const tz = ctx.organisation.timezone;

  return (
    <>
      <PageHeader title="Viewing requests" description={`Requests from buyers' microsites. A request is not confirmed until your team confirms a time. Times in ${timezoneLabel(tz)}.`} />
      <div className="mb-4 flex gap-4 border-b border-border text-sm">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={v.value === "open" ? "/dashboard/viewings" : `/dashboard/viewings?view=${v.value}`}
            className={cn("-mb-px border-b-2 px-1 pb-2.5 font-medium", view === v.value ? "border-emerald-brand" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {v.label}
          </Link>
        ))}
      </div>
      {result.requests.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={view === "open" ? "Nothing needs action" : view === "upcoming" ? "No upcoming confirmed viewings" : "No viewing requests yet"}
          description="Buyers can request a viewing directly from their personalised microsite."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Buyer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Home</TableHead>
                  <TableHead>Requested for</TableHead>
                  <TableHead>Confirmed time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.requests.map((r) => (
                  <TableRow key={r.id} className="text-sm">
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/enquiries/${r.leadId}`} className="hover:underline">
                        {r.name}
                      </Link>
                      {r.name !== r.buyerName && <div className="text-xs text-muted-foreground">Enquiry: {r.buyerName}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatPhone(r.phone)}</TableCell>
                    <TableCell>
                      {r.propertyLabel ?? <span className="text-muted-foreground">Any selected home</span>}
                      {r.developmentName && <div className="text-xs text-muted-foreground">{r.developmentName}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCalendarDate(r.preferredDate)}
                      <div className="text-xs text-muted-foreground">{TIME_RANGE_LABELS[r.preferredTimeRange as TimeRange] ?? r.preferredTimeRange}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.scheduledFor ? formatDateTime(r.scheduledFor, tz) : <span className="text-muted-foreground">Not confirmed</span>}</TableCell>
                    <TableCell>
                      <ViewingStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{relativeTime(r.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <ViewingManager request={r} timezone={tz} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/dashboard/viewings" params={{ view: sp.view }} />
    </>
  );
}
