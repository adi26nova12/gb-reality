import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ActionButton } from "@/components/app/action-button";
import { buttonVariants } from "@/components/ui/button";
import { requireAuth } from "@/server/auth";
import { listNotifications } from "@/server/data/insights";
import { markNotificationsRead } from "@/server/actions/account";
import { formatDateTime } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  const items = await listNotifications(ctx);
  const unread = items.filter((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="In-app alerts for enquiries assigned to you. Choose which ones you receive in Settings."
        actions={
          <>
            <Link href="/dashboard/settings#notifications" className={buttonVariants({ variant: "outline" })}>
              Preferences
            </Link>
            {unread.length > 0 && (
              <ActionButton variant="outline" action={markNotificationsRead.bind(null, "all")}>
                Mark all as read
              </ActionButton>
            )}
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="You'll be notified when a buyer first opens their microsite or requests a viewing." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((n) => (
            <li key={n.id} className={cn("flex gap-4 p-4 sm:p-5", !n.readAt && "bg-emerald-soft/40")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-emerald-brand")} aria-label={n.readAt ? undefined : "Unread"} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(n.createdAt, ctx.organisation.timezone)}
                  {n.emailStatus === "accepted" && " · Email accepted by the provider (delivery not confirmed)"}
                  {n.emailStatus === "failed" && " · Email could not be sent"}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {n.leadId && (
                  <Link href={`/dashboard/enquiries/${n.leadId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Open enquiry
                  </Link>
                )}
                {!n.readAt && (
                  <ActionButton variant="ghost" size="sm" action={markNotificationsRead.bind(null, [n.id])}>
                    Mark read
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
