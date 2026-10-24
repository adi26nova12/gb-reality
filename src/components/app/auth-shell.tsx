import { Logo } from "@/components/brand/logo";

/** Split layout for sign-in and setup screens. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-charcoal p-12 text-ivory lg:flex lg:flex-col">
        <Logo />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(var(--champagne) 1px, transparent 1px), linear-gradient(90deg, var(--champagne) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
          aria-hidden
        />
        <div className="relative mt-auto max-w-md">
          <div className="hairline mb-8 w-24" />
          <p className="font-display text-[2.4rem] leading-[1.1] font-medium text-[#f3efe6]">
            Every enquiry deserves a home tour of its own.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-[#b9b4a9]">
            Turn enquiries into personalised property selections, share them on WhatsApp, and see what each buyer explores before
            you follow up.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo tone="dark" />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
