import type { Metadata } from "next";
import { AuthShell } from "@/components/app/auth-shell";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/account";

export const metadata: Metadata = { title: "No organisation" };
export const dynamic = "force-dynamic";

export default function NoAccessPage() {
  return (
    <AuthShell>
      <div className="eyebrow mb-2 text-brass">Access pending</div>
      <h1 className="font-display text-3xl font-semibold">You&apos;re signed in, but not part of a team yet</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Your account is not a member of any organisation, so there is no data to show. Ask your administrator to add you, then sign in
        again.
      </p>
      <form action={signOut} className="mt-8">
        <Button type="submit" variant="outline" size="lg" className="w-full">
          Sign out
        </Button>
      </form>
    </AuthShell>
  );
}
