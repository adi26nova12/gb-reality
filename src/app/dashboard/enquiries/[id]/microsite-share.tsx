"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, ExternalLink, Eye, Loader2, MessageCircle, RefreshCw, ShieldOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/app/copy-button";
import { ActionButton } from "@/components/app/action-button";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/domain/whatsapp";
import { formatDateTime } from "@/lib/domain/dates";
import { extendMicrosite, recordWhatsAppInitiated, revokeMicrosite } from "@/server/actions/microsites";
import { markLeadContacted } from "@/server/actions/leads";
import type { MicrositeState } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface MicrositeShareProps {
  leadId: string;
  microsite: {
    id: string;
    state: MicrositeState;
    url: string | null;
    urlError: string | null;
    createdAt: string;
    expiresAt: string | null;
    firstOpenedAt: string | null;
    lastActivityAt: string | null;
    whatsappInitiatedAt: string | null;
    messageSentConfirmedAt: string | null;
  };
  buyerName: string;
  buyerPhone: string;
  developmentName: string;
  configuration: string;
  agentName: string | null;
  contactedAt: string | null;
  timezone: string;
  highlight: boolean;
  /** The development has a cover image, so a personalised welcome image can be made. */
  hasCoverImage: boolean;
}

function Step({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <li className="flex gap-3">
      {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-brand" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden />}
      <div>
        <div className={cn("text-sm", done ? "font-medium" : "text-muted-foreground")}>
          <span className="sr-only">{done ? "Done: " : "Not yet: "}</span>
          {label}
        </div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </li>
  );
}

export function MicrositeShare(p: MicrositeShareProps) {
  const router = useRouter();
  const [opening, startOpening] = useTransition();
  const ms = p.microsite;
  const [initiatedAt, setInitiatedAt] = useState(ms.whatsappInitiatedAt);
  const active = ms.state === "active";

  const message = useMemo(
    () =>
      ms.url
        ? buildWhatsAppMessage({
            buyerName: p.buyerName,
            developmentName: p.developmentName,
            configuration: p.configuration,
            micrositeUrl: ms.url,
            agentName: p.agentName,
          })
        : "",
    [ms.url, p.buyerName, p.developmentName, p.configuration, p.agentName],
  );
  const whatsapp = useMemo(() => {
    if (!message) return { url: null, error: null };
    try {
      return { url: buildWhatsAppUrl(p.buyerPhone, message), error: null };
    } catch (e) {
      return { url: null, error: (e as Error).message };
    }
  }, [message, p.buyerPhone]);

  // The link itself opens WhatsApp (a real anchor is never pop-up blocked);
  // this only records that the agent initiated it.
  function recordInitiated() {
    setInitiatedAt(new Date().toISOString());
    startOpening(async () => {
      const result = await recordWhatsAppInitiated(ms.id);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  const tz = p.timezone;
  const contacted = Boolean(p.contactedAt || ms.messageSentConfirmedAt);

  return (
    <section
      id="share"
      className={cn("rounded-xl border bg-card", p.highlight ? "border-emerald-brand shadow-[0_0_0_4px_rgba(15,95,71,0.08)]" : "border-border")}
      aria-labelledby="share-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-6">
        <div>
          {p.highlight && <div className="eyebrow mb-1 text-brass">Step 3 of 3</div>}
          <h2 id="share-heading" className="text-base font-semibold">
            Personalised microsite
          </h2>
          <p className="text-xs text-muted-foreground">
            Created {formatDateTime(ms.createdAt, tz)} · {ms.expiresAt ? `${ms.state === "expired" ? "Expired" : "Expires"} ${formatDateTime(ms.expiresAt, tz)}` : "No expiry"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/microsites/${ms.id}/preview`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Eye aria-hidden /> Preview
          </Link>
          <Link href={`/dashboard/enquiries/${p.leadId}/microsite`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <RefreshCw aria-hidden /> Change properties
          </Link>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {ms.state === "expired" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 p-3 text-sm">
            <span>This link has expired and no longer shows any property content.</span>
            <ActionButton size="sm" variant="outline" action={() => extendMicrosite(ms.id, 30)}>
              Reopen for 30 days
            </ActionButton>
          </div>
        )}

        {ms.urlError ? (
          <p role="alert" className="rounded-lg border border-[#f2cfcc] bg-[#fbeceb] p-3 text-sm text-destructive">
            {ms.urlError}
          </p>
        ) : (
          ms.url && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Secure link</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <code className="flex-1 truncate rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs" title={ms.url}>
                  {ms.url}
                </code>
                <div className="flex gap-2">
                  <CopyButton value={ms.url} label="Copy link" size="lg" successMessage="Link copied" />
                  <a href={ms.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
                    <ExternalLink aria-hidden /> Open
                  </a>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Opening the link yourself records a buyer visit. Use Preview to check the page without recording anything.</p>
            </div>
          )
        )}

        {active && ms.url && (
          <div className="rounded-xl border border-border bg-[#fbfaf7] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Share on WhatsApp</h3>
                <p className="text-xs text-muted-foreground">WhatsApp opens with {p.buyerName.split(" ")[0]}’s number and this message ready. Nothing is sent until you press Send in WhatsApp.</p>
              </div>
            </div>
            <pre className="mt-4 max-h-56 overflow-auto rounded-lg border border-border bg-card p-4 font-sans text-[0.8rem] leading-relaxed whitespace-pre-wrap text-foreground/90">{message}</pre>
            {whatsapp.error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {whatsapp.error}. Edit the enquiry to fix the number.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {whatsapp.url ? (
                <a
                  href={whatsapp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={recordInitiated}
                  className={buttonVariants({ size: "lg", className: "bg-[#128c4b] text-white hover:bg-[#0f7a41]" })}
                >
                  {opening ? <Loader2 className="animate-spin" aria-hidden /> : <MessageCircle aria-hidden />}
                  Send via WhatsApp
                </a>
              ) : (
                <Button size="lg" disabled>
                  <MessageCircle aria-hidden /> Send via WhatsApp
                </Button>
              )}
              <CopyButton value={message} label="Copy message" size="lg" successMessage="Message copied" />
            </div>
          </div>
        )}

        {active && p.hasCoverImage && (
          <div className="flex flex-col gap-5 rounded-xl border border-border p-5 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated per request, not optimisable */}
            <img
              src={`/dashboard/enquiries/${p.leadId}/welcome-image?format=portrait`}
              alt={`Personalised welcome image for ${p.buyerName.split(" ")[0]}`}
              className="aspect-[4/5] w-full max-w-44 rounded-lg border border-border bg-muted object-cover"
              loading="lazy"
            />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Personalised welcome image</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {p.buyerName.split(" ")[0]}&rsquo;s name over the development&rsquo;s cover. The link preview in WhatsApp shows the wide version automatically. To send it as a
                photo too, download it and attach it in the chat: click-to-chat links cannot attach images.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`/dashboard/enquiries/${p.leadId}/welcome-image?format=portrait&download=1`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
                  Download for WhatsApp (4:5)
                </a>
                <a href={`/dashboard/enquiries/${p.leadId}/welcome-image?format=landscape&download=1`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
                  Download wide
                </a>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contact tracking</h3>
          <ol className="space-y-3">
            <Step done label="Link generated" detail={formatDateTime(ms.createdAt, tz)} />
            <Step
              done={Boolean(initiatedAt)}
              label="WhatsApp opened with the message"
              detail={initiatedAt ? `${formatDateTime(initiatedAt, tz)} · this only shows WhatsApp was opened, not that a message was sent` : "Not yet"}
            />
            <Step
              done={contacted}
              label="Agent confirmed the message was sent"
              detail={contacted ? formatDateTime(ms.messageSentConfirmedAt ?? p.contactedAt, tz) : "Confirm after you have pressed Send in WhatsApp"}
            />
            <Step done={false} label="Delivery confirmation" detail="Not available with click-to-chat links. Requires the official WhatsApp Business Platform." />
            <Step done={Boolean(ms.firstOpenedAt)} label="Buyer opened the microsite" detail={ms.firstOpenedAt ? formatDateTime(ms.firstOpenedAt, tz) : "Not yet"} />
          </ol>
          {!contacted && active && (
            <ActionButton className="mt-5" variant={initiatedAt ? "default" : "outline"} action={() => markLeadContacted(p.leadId)}>
              <CheckCircle2 aria-hidden /> I sent the message — Mark as Contacted
            </ActionButton>
          )}
        </div>

        {ms.state !== "revoked" && (
          <div className="border-t border-border pt-5">
            <ActionButton
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              action={() => revokeMicrosite(ms.id)}
              confirm={{
                title: "Revoke this link?",
                description: "The buyer will see an expired-link page and no property content. This cannot be undone, but you can generate a new link afterwards.",
                confirmLabel: "Revoke link",
                destructive: true,
              }}
            >
              <ShieldOff aria-hidden /> Revoke link
            </ActionButton>
          </div>
        )}
      </div>
    </section>
  );
}
