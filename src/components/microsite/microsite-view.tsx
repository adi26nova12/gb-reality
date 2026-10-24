"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, Download, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MediaImage } from "@/components/app/media-image";
import { displayE164, e164Digits } from "@/lib/domain/phone-format";
import { mediaUrl } from "@/lib/media";
import type { PublicMicrosite } from "@/lib/types";
import { PropertyCard } from "./property-card";
import { TrackerProvider, useTracker } from "./tracker";
import { ViewingRequestForm } from "./viewing-request-form";
import { cn } from "@/lib/utils";

function Section({ id, eyebrow, title, children, className }: { id?: string; eyebrow?: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 px-5 py-14 sm:px-8 sm:py-20", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mx-auto max-w-5xl">
        {eyebrow && <div className="eyebrow mb-3 text-brass">{eyebrow}</div>}
        <h2 id={id ? `${id}-title` : undefined} className="font-display text-3xl leading-tight font-semibold text-charcoal sm:text-4xl">
          {title}
        </h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Body({ site, preview, brochureHref }: { site: PublicMicrosite; preview: boolean; brochureHref: string | null }) {
  const { track } = useTracker();
  const opened = useRef(false);
  const [selectedRef, setSelectedRef] = useState("");
  const [showMap, setShowMap] = useState(false);
  const d = site.development;
  const name = site.buyerFirstName;
  const multiDev = new Set(site.properties.map((p) => p.developmentName)).size > 1 || site.properties.some((p) => p.developmentName !== d.name);
  const contactPhone = site.agent.phone ?? d.contactPhone;
  const contactName = site.agent.name ?? d.contactName ?? site.organisationName;

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("microsite_opened");
  }, [track]);

  const requestViewing = (ref: string) => {
    setSelectedRef(ref);
    document.getElementById("viewing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const mapEmbed =
    d.latitude !== null && d.longitude !== null
      ? `https://maps.google.com/maps?q=${d.latitude},${d.longitude}&z=15&output=embed`
      : d.address
        ? `https://maps.google.com/maps?q=${encodeURIComponent(d.address)}&z=15&output=embed`
        : null;
  const mapLink = d.mapUrl ?? (d.latitude !== null && d.longitude !== null ? `https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}` : d.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}` : null);

  const whatsappHref = contactPhone
    ? `https://wa.me/${e164Digits(contactPhone)}?text=${encodeURIComponent(`Hi${site.agent.name ? ` ${site.agent.name.split(" ")[0]}` : ""}, I'm looking at my property selection for ${d.name} and have a question.`)}`
    : null;
  const brochureUrl = site.brochure ? mediaUrl(site.brochure.path) : null;

  return (
    <div className="relative min-h-screen bg-ivory pb-24 text-charcoal sm:pb-0">
      {preview && (
        <div className="sticky top-0 z-40 bg-brass px-4 py-2 text-center text-xs font-medium text-charcoal">Agent preview · no engagement is recorded and forms are disabled</div>
      )}
      <header className={cn("absolute inset-x-0 z-30 flex items-center justify-between px-5 py-4 sm:px-8", preview ? "top-8" : "top-0")}>
        <span className="text-xs font-medium tracking-[0.2em] text-white/85 uppercase">{site.organisationName}</span>
        <a href="#viewing" className="hidden rounded-full border border-white/40 bg-black/20 px-4 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-black/35 sm:inline-block">
          Request a viewing
        </a>
      </header>

      {/* Personalised welcome: the buyer's first name set over the development's cover. */}
      <div className="relative isolate flex min-h-[86svh] items-end overflow-hidden bg-charcoal sm:min-h-[78vh] sm:items-center">
        {d.coverImagePath || d.coverImageMobilePath ? (
          <>
            <MediaImage
              path={d.coverImageMobilePath ?? d.coverImagePath}
              alt={d.name}
              className="absolute inset-0 -z-10 sm:hidden"
              sizes="100vw"
              priority
            />
            <MediaImage path={d.coverImagePath ?? d.coverImageMobilePath} alt="" className="absolute inset-0 -z-10 hidden sm:block" sizes="100vw" priority />
          </>
        ) : (
          <div
            className="absolute inset-0 -z-10 opacity-[0.12]"
            style={{ backgroundImage: "linear-gradient(var(--champagne) 1px, transparent 1px), linear-gradient(90deg, var(--champagne) 1px, transparent 1px)", backgroundSize: "64px 64px" }}
            aria-hidden
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal via-charcoal/40 to-charcoal/5 sm:bg-gradient-to-r sm:from-charcoal/80 sm:via-charcoal/30 sm:to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 -z-10 hidden h-1/3 bg-gradient-to-t from-charcoal/70 to-transparent sm:block" aria-hidden />
        <div className="mx-auto w-full max-w-6xl px-5 pb-14 sm:px-10 sm:pb-0">
          <div className="max-w-xl animate-in duration-1000 fade-in slide-in-from-bottom-3">
            {name ? (
              <>
                <div className="eyebrow mb-3 text-champagne">Prepared exclusively for</div>
                <h1 className="font-display text-[4.2rem] leading-[0.95] font-semibold text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)] sm:text-[6.5rem]">
                  {name}
                </h1>
                <div className="hairline my-6 w-28" />
                <p className="font-display text-2xl leading-tight text-white/95 sm:text-3xl">Welcome to {d.name}</p>
              </>
            ) : (
              <>
                <h1 className="font-display text-5xl leading-[1.02] font-semibold text-white sm:text-7xl">{d.name}</h1>
                <div className="hairline mt-6 w-28" />
              </>
            )}
            {(d.location || d.developerName) && (
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
                {d.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-champagne" aria-hidden /> {d.location}
                  </span>
                )}
                {d.developerName && <span>by {d.developerName}</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="px-5 pt-14 sm:px-8 sm:pt-20">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <h2 className="font-display text-[2.1rem] leading-[1.1] font-semibold sm:text-5xl">
              {name ? `${name}, explore the ${site.configuration} homes selected for you.` : `Explore the ${site.configuration} homes selected for you.`}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-charcoal/75">
              {site.introMessage ??
                `Based on your preferences, ${contactName} has selected ${site.properties.length} ${site.properties.length === 1 ? "home" : "homes"} at ${d.name}. Prices and availability shown here are kept up to date.`}
            </p>
          </div>
          {contactName && (
            <div className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
              <div className="text-xs text-muted-foreground">Your property contact</div>
              <div className="mt-1 font-medium">{contactName}</div>
              {contactPhone && <div className="text-sm text-muted-foreground tabular-nums">{displayE164(contactPhone)}</div>}
            </div>
          )}
        </div>
      </section>

      <Section id="homes" eyebrow={`${site.properties.length} selected`} title="Your homes">
        {site.properties.length === 0 ? (
          <p className="text-charcoal/70">Your property contact is updating this selection. Please check back shortly.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {site.properties.map((p) => (
              <PropertyCard key={p.ref} p={p} onRequestViewing={requestViewing} showDevelopment={multiDev} />
            ))}
          </div>
        )}
      </Section>

      {(d.description || d.amenities.length > 0) && (
        <Section eyebrow="The development" title={`Life at ${d.name}`} className="bg-white">
          {d.description && <p className="max-w-3xl text-base leading-relaxed whitespace-pre-wrap text-charcoal/80">{d.description}</p>}
          {d.amenities.length > 0 && (
            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {d.amenities.map((a) => (
                <li key={a} className="flex items-center gap-3 border-b border-[#ece6da] pb-3 text-sm">
                  <span className="size-1.5 rounded-full bg-brass" aria-hidden /> {a}
                </li>
              ))}
            </ul>
          )}
          {d.galleryPaths.length > 0 && (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {d.galleryPaths.slice(0, 6).map((path, i) => (
                <MediaImage key={path} path={path} alt={`${d.name}, image ${i + 1}`} className="aspect-[4/3] rounded-xl" sizes="(max-width: 640px) 50vw, 33vw" />
              ))}
            </div>
          )}
        </Section>
      )}

      {d.paymentPlan.length > 0 && (
        <Section eyebrow="Pricing" title="Payment plan">
          <details
            className="group rounded-2xl border border-[#e6e0d4] bg-white"
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) track("payment_plan_opened");
            }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
              <span className="font-medium">See how payments are staged</span>
              <ChevronDown className="size-5 text-brass transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <dl className="divide-y divide-[#ece6da] border-t border-[#ece6da]">
              {d.paymentPlan.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <dt className="text-sm text-charcoal/75">{m.label}</dt>
                  <dd className="font-display text-xl font-semibold">{m.value}</dd>
                </div>
              ))}
            </dl>
            {d.paymentPlanNotes && <p className="border-t border-[#ece6da] px-5 py-4 text-xs text-muted-foreground sm:px-6">{d.paymentPlanNotes}</p>}
          </details>
        </Section>
      )}

      <Section eyebrow="Brochure" title="The full brochure" className="bg-white">
        {site.brochure && brochureHref ? (
          <div className="flex flex-col gap-6 rounded-2xl bg-charcoal p-6 text-ivory sm:flex-row sm:items-center sm:p-8">
            <BookOpen className="size-10 shrink-0 text-brass" aria-hidden />
            <div className="flex-1">
              <div className="font-display text-2xl font-semibold">{site.brochure.title}</div>
              <p className="mt-1 text-sm text-[#b9b4a9]">Specifications, layouts and finishes, readable on your phone.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={brochureHref} className={buttonVariants({ size: "lg", className: "h-11 bg-ivory px-5 text-charcoal hover:bg-white" })}>
                Read brochure <ArrowRight aria-hidden />
              </Link>
              {site.brochure.allowDownload && brochureUrl && (
                <a
                  href={brochureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  onClick={() => track("brochure_download_requested")}
                  className={buttonVariants({ variant: "outline", size: "lg", className: "h-11 border-white/30 bg-transparent text-ivory hover:bg-white/10 hover:text-white" })}
                >
                  <Download aria-hidden /> Download
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d9cfbb] p-8 text-center">
            <BookOpen className="mx-auto size-8 text-brass" aria-hidden />
            <p className="mt-3 font-medium">The digital brochure is being prepared</p>
            <p className="mt-1 text-sm text-muted-foreground">Ask your property contact and they will share it with you directly.</p>
          </div>
        )}
      </Section>

      {(d.address || d.location || mapLink) && (
        <Section eyebrow="Location" title="Where you'll live">
          <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-start">
            <div>
              <p className="flex gap-2 text-base">
                <MapPin className="mt-1 size-4 shrink-0 text-brass" aria-hidden />
                {d.address ?? d.location}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {mapEmbed && !showMap && (
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      setShowMap(true);
                      track("map_opened");
                    }}
                  >
                    Show map here
                  </Button>
                )}
                {mapLink && (
                  <a href={mapLink} target="_blank" rel="noopener noreferrer" onClick={() => track("map_opened")} className={buttonVariants({ variant: "outline", className: "h-11" })}>
                    Open in Google Maps
                  </a>
                )}
              </div>
              {mapEmbed && !showMap && <p className="mt-3 text-xs text-muted-foreground">The map loads from Google only when you ask for it.</p>}
            </div>
            {showMap && mapEmbed && (
              <iframe title={`Map of ${d.name}`} src={mapEmbed} className="aspect-[4/3] w-full rounded-2xl border border-[#e6e0d4]" loading="lazy" referrerPolicy="no-referrer" />
            )}
          </div>
        </Section>
      )}

      <Section id="viewing" eyebrow="Visit" title="Request a viewing" className="bg-white">
        <ViewingRequestForm properties={site.properties} defaultName={name ?? ""} selectedRef={selectedRef} onSelectRef={setSelectedRef} preview={preview} />
      </Section>

      {(whatsappHref || contactPhone) && (
        <Section eyebrow="Questions" title={`Talk to ${contactName}`}>
          <div className="flex flex-wrap gap-3">
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_clicked")} className={buttonVariants({ size: "lg", className: "h-12 bg-[#128c4b] px-6 text-base text-white hover:bg-[#0f7a41]" })}>
                <MessageCircle aria-hidden /> WhatsApp
              </a>
            )}
            {contactPhone && (
              <a href={`tel:${contactPhone}`} className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-6 text-base" })}>
                <Phone aria-hidden /> Call
              </a>
            )}
          </div>
          {d.contactEmail && <p className="mt-4 text-sm text-muted-foreground">Or email {d.contactEmail}</p>}
        </Section>
      )}

      <footer className="bg-charcoal px-5 py-12 text-[#a8a397] sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
            <div className="space-y-2 text-xs leading-relaxed">
              <p className="text-sm font-medium text-ivory">Your privacy</p>
              <p>
                This page was prepared for you by {site.organisationName}. To help your property contact follow up usefully, we record when this page is opened and
                which sections you open, such as floor plans, the payment plan and brochure pages. We do not use cookies, advertising trackers or device fingerprinting,
                and we do not sell or share this information.
              </p>
              <p>
                Your link is personal; please don&apos;t forward it. To ask about or delete the information held about you, contact {contactName}
                {d.contactEmail ? ` at ${d.contactEmail}` : ""}.
              </p>
              <p>Prices, availability and plans are indicative and subject to change; please confirm details with the property team.</p>
            </div>
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-[#e6e0d4] bg-white/95 p-3 backdrop-blur sm:hidden">
        <a href="#viewing" className={buttonVariants({ size: "lg", className: "h-12 flex-1 text-base" })}>
          Request viewing
        </a>
        {whatsappHref && (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_clicked")} aria-label="Message on WhatsApp" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 w-14" })}>
            <MessageCircle className="text-[#128c4b]" />
          </a>
        )}
      </div>
    </div>
  );
}

export function MicrositeView({
  site,
  token,
  preview = false,
  brochureHref: brochureHrefOverride,
}: {
  site: PublicMicrosite;
  token: string | null;
  preview?: boolean;
  brochureHref?: string;
}) {
  const brochureHref = brochureHrefOverride ?? (token ? `/p/${token}/brochure` : site.brochure ? mediaUrl(site.brochure.path) : null);
  return (
    <TrackerProvider token={token} enabled={!preview && Boolean(token)}>
      <Body site={site} preview={preview} brochureHref={brochureHref} />
    </TrackerProvider>
  );
}
