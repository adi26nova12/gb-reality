"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/app/field";
import { ActionButton } from "@/components/app/action-button";
import { addMember, inviteMember, removeMember, setMemberRole } from "@/server/actions/team";

type Role = "owner" | "admin" | "agent";
const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Admin", agent: "Agent" };
const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including managing other owners",
  admin: "Manage the team (except owners) and all records",
  agent: "Work with enquiries, the catalogue and microsites",
};

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: Role;
}

function RoleSelect({ value, onChange, allowOwner, disabled, id }: { value: Role; onChange: (r: Role) => void; allowOwner: boolean; disabled?: boolean; id?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)} disabled={disabled}>
      <SelectTrigger id={id} className="w-32" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(["agent", "admin", "owner"] as Role[])
          .filter((r) => allowOwner || r !== "owner" || value === "owner")
          .map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function MemberRow({ member, currentUserId, currentRole }: { member: TeamMember; currentUserId: string; currentRole: Role }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isOwner = currentRole === "owner";
  // Admins cannot change owners; the database enforces the same rule.
  const locked = member.role === "owner" && !isOwner;

  const changeRole = (role: Role) =>
    startTransition(async () => {
      const r = await setMemberRole(member.id, role);
      if (!r.ok) toast.error(r.error);
      else toast.success(r.message ?? "Role updated");
      router.refresh();
    });

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {member.name}
          {member.id === currentUserId && <span className="font-normal text-muted-foreground"> (you)</span>}
        </div>
        {member.email && <div className="truncate text-xs text-muted-foreground">{member.email}</div>}
      </div>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
      <RoleSelect value={member.role} onChange={changeRole} allowOwner={isOwner} disabled={locked || pending} />
      <ActionButton
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={locked}
        action={removeMember.bind(null, member.id)}
        confirm={{
          title: member.id === currentUserId ? "Leave this organisation?" : `Remove ${member.name}?`,
          description: "They will immediately lose access to this organisation's data. Enquiries assigned to them become unassigned. Their account itself is not deleted.",
          confirmLabel: member.id === currentUserId ? "Leave" : "Remove",
          destructive: true,
        }}
      >
        {member.id === currentUserId ? "Leave" : "Remove"}
      </ActionButton>
    </li>
  );
}

export function TeamManager({
  members,
  currentUserId,
  currentRole,
  invitesEnabled,
}: {
  members: TeamMember[];
  currentUserId: string;
  currentRole: Role;
  invitesEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (mode: "add" | "invite") =>
    startTransition(async () => {
      setError(null);
      const r = mode === "add" ? await addMember({ email, role }) : await inviteMember({ email, role, fullName });
      if (!r.ok) {
        setError(r.fieldErrors?.email ?? r.error);
        return;
      }
      toast.success(r.message ?? "Done");
      setEmail("");
      setFullName("");
      setRole("agent");
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Members ({members.length})</h2>
        <ul className="mt-2 divide-y divide-border">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} currentUserId={currentUserId} currentRole={currentRole} />
          ))}
        </ul>
        <dl className="mt-5 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
            <div key={r}>
              <dt className="font-medium text-foreground">{ROLE_LABELS[r]}</dt>
              <dd>{ROLE_HELP[r]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Add someone</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {invitesEnabled
            ? "Invite a new person by email, or add someone who already has an account."
            : "Add someone who already has an account. Invitations are off because SUPABASE_SECRET_KEY is not set on the server."}
        </p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            submit(invitesEnabled ? "invite" : "add");
          }}
        >
          <Field id="member-email" label="Email" required>
            <Input id="member-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} />
          </Field>
          {invitesEnabled ? (
            <Field id="member-name" label="Name (for the invitation)">
              <Input id="member-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Field id="member-role" label="Role">
            <RoleSelect id="member-role" value={role} onChange={setRole} allowOwner={currentRole === "owner"} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-3">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            {invitesEnabled && (
              <Button type="submit" disabled={pending || !email}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
                Send invitation
              </Button>
            )}
            <Button type={invitesEnabled ? "button" : "submit"} variant={invitesEnabled ? "outline" : "default"} disabled={pending || !email} onClick={invitesEnabled ? () => submit("add") : undefined}>
              {!invitesEnabled && pending ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
              Add existing account
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
