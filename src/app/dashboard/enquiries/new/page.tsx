import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireAuth } from "@/server/auth";
import { developmentOptions } from "@/server/data/catalogue";
import { listAgents } from "@/server/data/leads";
import { LeadForm } from "../lead-form";

export const metadata: Metadata = { title: "New enquiry" };

export default async function NewEnquiryPage() {
  const ctx = await requireAuth();
  const [developments, agents] = await Promise.all([developmentOptions(ctx), listAgents(ctx)]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ href: "/dashboard/enquiries", label: "Enquiries" }}
        eyebrow="Step 1 of 3"
        title="New enquiry"
        description="Record the buyer's details. Next you'll review matching properties, then generate and share their microsite."
      />
      {developments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Add a development first"
          description="Enquiries are matched against your property catalogue, so at least one development is needed."
          action={
            <Link href="/dashboard/developments/new" className={buttonVariants()}>
              Add development
            </Link>
          }
        />
      ) : (
        <LeadForm mode="create" developments={developments} agents={agents} currentUserId={ctx.userId} />
      )}
    </div>
  );
}
