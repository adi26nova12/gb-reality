import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { displayName, requireAuth } from "@/server/auth";
import { unreadNotificationCount } from "@/server/data/insights";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  const [unread, openViewings] = await Promise.all([
    unreadNotificationCount(ctx),
    ctx.supabase
      .from("viewing_requests")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", ctx.organisation.id)
      .eq("status", "requested")
      .then((r) => r.count ?? 0),
  ]);

  return (
    <div className="min-h-screen">
      <Sidebar organisationName={ctx.organisation.name} openViewings={openViewings} isSample={ctx.organisation.isSample} />
      <div className="lg:pl-64">
        <Topbar
          userName={displayName(ctx)}
          email={ctx.email}
          organisationName={ctx.organisation.name}
          organisations={ctx.organisations}
          currentOrganisationId={ctx.organisation.id}
          unread={unread}
          openViewings={openViewings}
          isSample={ctx.organisation.isSample}
        />
        <main className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
