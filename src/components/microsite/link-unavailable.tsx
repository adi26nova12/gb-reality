import { Logo } from "@/components/brand/logo";

const COPY = {
  expired: {
    title: "This link has expired",
    body: "Personalised property selections are only available for a limited time. Please contact your property advisor and they will send you an up-to-date link.",
  },
  revoked: {
    title: "This link is no longer active",
    body: "Your property advisor has replaced or closed this selection. Please contact them for a current link.",
  },
  not_found: {
    title: "We couldn't find this page",
    body: "The link may be incomplete. Please check that you opened the full link from your message, or ask your property advisor to send it again.",
  },
  unavailable: {
    title: "This page is temporarily unavailable",
    body: "Please try again in a few minutes.",
  },
} as const;

export function LinkUnavailable({ reason }: { reason: keyof typeof COPY }) {
  const c = COPY[reason];
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-6 text-center">
      <Logo />
      <div className="hairline mx-auto my-10 w-24" />
      <h1 className="font-display text-4xl font-semibold text-ivory">{c.title}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[#b9b4a9]">{c.body}</p>
    </main>
  );
}
