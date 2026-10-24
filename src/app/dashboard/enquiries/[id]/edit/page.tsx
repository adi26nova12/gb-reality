import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { requireAuth } from "@/server/auth";
import { developmentOptions } from "@/server/data/catalogue";
import { getLeadForEdit, listAgents } from "@/server/data/leads";
import { formatPhone } from "@/lib/domain/phone";
import { LeadForm } from "../../lead-form";

export const metadata: Metadata = { title: "Edit enquiry" };

export default async function EditEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAuth();
  const [lead, developments, agents] = await Promise.all([getLeadForEdit(ctx, id), developmentOptions(ctx), listAgents(ctx)]);
  if (!lead) notFound();

  const devs = developments.some((d) => d.id === lead.developmentId)
    ? developments
    : [...developments, { id: lead.developmentId, name: `${lead.developmentName} (archived)` }];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ href: `/dashboard/enquiries/${id}`, label: lead.buyerName }} title="Edit enquiry" />
      <LeadForm
        mode="edit"
        leadId={id}
        developments={devs}
        agents={agents}
        currentUserId={ctx.userId}
        defaults={{
          buyerName: lead.buyerName,
          phone: formatPhone(lead.phone),
          developmentId: lead.developmentId,
          configuration: lead.configuration as never,
          email: lead.email ?? "",
          budgetMin: lead.budgetMin !== null ? String(lead.budgetMin) : "",
          budgetMax: lead.budgetMax !== null ? String(lead.budgetMax) : "",
          preferredLocation: lead.preferredLocation ?? "",
          bedrooms: lead.bedrooms !== null ? String(lead.bedrooms) : "",
          preferredFloor: lead.preferredFloor ?? "",
          propertyType: (lead.propertyType ?? "none") as never,
          purchaseTimeframe: (lead.purchaseTimeframe ?? "none") as never,
          assignedAgentId: lead.assignedAgentId ?? "none",
          notes: lead.notes ?? "",
          contactPreference: lead.contactPreference as never,
        }}
      />
    </div>
  );
}
