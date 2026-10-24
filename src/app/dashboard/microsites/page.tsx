import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Globe } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination } from "@/components/app/pagination";
import { MicrositeStateBadge } from "@/components/app/status-badges";
import { ActionButton } from "@/components/app/action-button";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAuth } from "@/server/auth";
import { listMicrosites } from "@/server/data/insights";
import { revokeMicrosite } from "@/server/actions/microsites";
import { formatDateTime, relativeTime } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Microsites" };

export default async function MicrositesPage({ searchParams }: { searchParams: Promise<{ state?: string; q?: string; page?: string }> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const state = ["active", "revoked", "expired"].includes(sp.state ?? "") ? sp.state : undefined;
  const result = await listMicrosites(ctx, { state, q: sp.q, page: Number(sp.page) || 1 });
  const tz = ctx.organisation.timezone;

  return (
    <>
      <PageHeader
        title="Microsites"
        description="Every personalised link issued to a buyer. Copy, resend and update links from the enquiry page."
      />
      <FilterBar
        searchPlaceholder="Search buyer name"
        selects={[{ name: "state", label: "Link status", allLabel: "All links", options: [{ value: "active", label: "Active" }, { value: "expired", label: "Expired" }, { value: "revoked", label: "Revoked" }] }]}
      />
      {result.microsites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={sp.q || state ? "No microsites match" : "No microsites yet"}
          description={sp.q || state ? undefined : "Generate one from an enquiry after reviewing matching properties."}
          action={!sp.q && !state ? <Link href="/dashboard/enquiries" className={buttonVariants()}>Go to enquiries</Link> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Buyer</TableHead>
                  <TableHead>Development</TableHead>
                  <TableHead>Homes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Latest activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.microsites.map((m) => (
                  <TableRow key={m.id} className="text-sm">
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/enquiries/${m.leadId}`} className="hover:text-emerald-brand hover:underline">
                        {m.buyerName}
                      </Link>
                    </TableCell>
                    <TableCell>{m.developmentName}</TableCell>
                    <TableCell className="tabular-nums">{m.propertyCount}</TableCell>
                    <TableCell>
                      <MicrositeStateBadge state={m.state} opened={Boolean(m.firstOpenedAt)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt, tz)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{m.lastActivityAt ? relativeTime(m.lastActivityAt) : "No buyer activity"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        <Link href={`/dashboard/microsites/${m.id}/preview`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          <Eye aria-hidden /> Preview
                        </Link>
                        <Link href={`/dashboard/enquiries/${m.leadId}#share`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          Link &amp; engagement
                        </Link>
                        {m.state !== "revoked" && (
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            action={revokeMicrosite.bind(null, m.id)}
                            confirm={{ title: `Revoke ${m.buyerName}'s link?`, description: "The buyer will see an expired-link page. This cannot be undone.", confirmLabel: "Revoke link", destructive: true }}
                          >
                            Revoke
                          </ActionButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/dashboard/microsites" params={{ state: sp.state, q: sp.q }} />
    </>
  );
}
