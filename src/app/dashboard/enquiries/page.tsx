import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Inbox, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination } from "@/components/app/pagination";
import { LeadStatusBadge, MicrositeStateBadge, SampleBadge } from "@/components/app/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAuth } from "@/server/auth";
import { developmentOptions } from "@/server/data/catalogue";
import { listAgents, listLeads } from "@/server/data/leads";
import { LEAD_STATUSES, LEAD_STATUS_META } from "@/lib/domain/lead-status";
import { formatBudgetRange } from "@/lib/domain/money";
import { formatDate, relativeTime } from "@/lib/domain/dates";
import { formatPhone } from "@/lib/domain/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Enquiries" };

type Search = { q?: string; status?: string; development?: string; agent?: string; sort?: string; dir?: string; page?: string; view?: string };

function SortHead({ link, children }: { link: { href: string; active: boolean; dir: string | null }; children: React.ReactNode }) {
  return (
    <TableHead aria-sort={link.active ? (link.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={link.href} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {link.dir === "asc" && <ArrowUp className="size-3" aria-hidden />}
        {link.dir === "desc" && <ArrowDown className="size-3" aria-hidden />}
      </Link>
    </TableHead>
  );
}

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const archived = sp.view === "archived";
  const [result, developments, agents] = await Promise.all([
    listLeads(ctx, {
      q: sp.q,
      status: LEAD_STATUSES.includes(sp.status as never) ? sp.status : undefined,
      developmentId: sp.development,
      agentId: sp.agent,
      archived,
      sort: sp.sort,
      dir: sp.dir,
      page: Number(sp.page) || 1,
    }),
    developmentOptions(ctx),
    listAgents(ctx),
  ]);

  const params = { q: sp.q, status: sp.status, development: sp.development, agent: sp.agent, sort: sp.sort, dir: sp.dir, view: sp.view };
  const sortLink = (key: string) => {
    const active = (sp.sort ?? "created") === key;
    const dir = active && sp.dir !== "asc" ? "asc" : "desc";
    const next = new URLSearchParams(Object.entries({ ...params, sort: key, dir }).filter(([, v]) => v) as [string, string][]);
    return { href: `/dashboard/enquiries?${next}`, active, dir: active ? (sp.dir === "asc" ? "asc" : "desc") : null };
  };
  const filtered = Boolean(sp.q || sp.status || sp.development || sp.agent);

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Every buyer enquiry, its microsite and what happened next."
        actions={
          <Link href="/dashboard/enquiries/new" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden /> New Enquiry
          </Link>
        }
      />

      <div className="mb-4 flex gap-4 border-b border-border text-sm">
        {[
          { label: "Active", href: "/dashboard/enquiries", on: !archived },
          { label: "Archived", href: "/dashboard/enquiries?view=archived", on: archived },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={cn("-mb-px border-b-2 px-1 pb-2.5 font-medium", t.on ? "border-emerald-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <FilterBar
        searchPlaceholder="Search name or mobile"
        selects={[
          { name: "status", label: "Status", allLabel: "All statuses", options: LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_META[s].label })) },
          { name: "development", label: "Development", allLabel: "All developments", options: developments.map((d) => ({ value: d.id, label: d.name })) },
          { name: "agent", label: "Agent", allLabel: "All agents", options: agents.map((a) => ({ value: a.id, label: a.name })) },
        ]}
      />

      {result.leads.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filtered ? "No enquiries match these filters" : archived ? "No archived enquiries" : "No enquiries yet"}
          description={filtered ? "Try clearing a filter or searching for part of the name." : archived ? undefined : "Create the first enquiry to match properties and generate a personalised microsite."}
          action={
            !filtered && !archived ? (
              <Link href="/dashboard/enquiries/new" className={buttonVariants()}>
                <Plus aria-hidden /> New Enquiry
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <SortHead link={sortLink("name")}>Buyer</SortHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Development</TableHead>
                  <TableHead>Config.</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Agent</TableHead>
                  <SortHead link={sortLink("status")}>Status</SortHead>
                  <TableHead>Microsite</TableHead>
                  <SortHead link={sortLink("engagement")}>Last engagement</SortHead>
                  <SortHead link={sortLink("created")}>Created</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.leads.map((l) => (
                  <TableRow key={l.id} className="text-sm">
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/enquiries/${l.id}`} className="hover:text-emerald-brand hover:underline">
                        {l.buyerName}
                      </Link>
                      {l.isSample && <SampleBadge className="ml-2" />}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{formatPhone(l.phone)}</TableCell>
                    <TableCell className="max-w-44 truncate">{l.developmentName}</TableCell>
                    <TableCell>{l.configuration}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatBudgetRange(l.budgetMin, l.budgetMax, l.budgetCurrency)}</TableCell>
                    <TableCell className="max-w-32 truncate text-muted-foreground">{l.assignedAgentName ?? "Unassigned"}</TableCell>
                    <TableCell>
                      <LeadStatusBadge status={l.status} />
                    </TableCell>
                    <TableCell>
                      <MicrositeStateBadge state={l.microsite?.state ?? null} opened={Boolean(l.microsite?.firstOpenedAt)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{l.lastEngagementAt ? relativeTime(l.lastEngagementAt) : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(l.createdAt, ctx.organisation.timezone)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/dashboard/enquiries" params={params} />
    </>
  );
}
