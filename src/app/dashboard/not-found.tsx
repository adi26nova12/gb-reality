import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Record not found"
      description="It may have been removed, or it belongs to an organisation you are not signed in to."
      action={
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Back to overview
        </Link>
      }
    />
  );
}
