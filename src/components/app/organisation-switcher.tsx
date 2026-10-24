"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { switchOrganisation } from "@/server/actions/account";

export function OrganisationSwitcher({ organisations, currentId }: { organisations: { id: string; name: string }[]; currentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={currentId}
      disabled={pending}
      onValueChange={(id) =>
        startTransition(async () => {
          const result = await switchOrganisation(id);
          if (!result.ok) toast.error(result.error);
          else router.push("/dashboard");
        })
      }
    >
      <SelectTrigger className="h-9 max-w-56 bg-card" aria-label="Switch organisation">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {organisations.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
