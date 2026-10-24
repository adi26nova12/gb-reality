import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { requireAuth } from "@/server/auth";
import { listAgents } from "@/server/data/leads";
import { getConfigStatus } from "@/lib/env";
import { TeamManager, type TeamMember } from "./team-manager";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireAuth();
  const back = { href: "/dashboard/settings", label: "Settings" };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={back} title="Team" />
        <EmptyState icon={ShieldAlert} title="Only owners and admins can manage the team" description="Ask an administrator if someone needs to be added or removed." />
      </div>
    );
  }

  const members = (await listAgents(ctx)).map((m) => ({ ...m, role: m.role as TeamMember["role"] }));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={back} title="Team" description={`Who can access ${ctx.organisation.name}. Changes take effect immediately.`} />
      <TeamManager members={members} currentUserId={ctx.userId} currentRole={ctx.role} invitesEnabled={getConfigStatus().invites} />
    </div>
  );
}
