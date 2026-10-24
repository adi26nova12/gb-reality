"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  CalendarCheck,
  ChartNoAxesColumn,
  Globe,
  Home,
  LayoutDashboard,
  Menu,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/enquiries", label: "Enquiries", icon: UsersRound },
  { href: "/dashboard/properties", label: "Properties", icon: Home },
  { href: "/dashboard/developments", label: "Developments", icon: Building2 },
  { href: "/dashboard/microsites", label: "Microsites", icon: Globe },
  { href: "/dashboard/analytics", label: "Engagement Analytics", icon: ChartNoAxesColumn },
  { href: "/dashboard/viewings", label: "Viewing Requests", icon: CalendarCheck },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate, openViewings }: { onNavigate?: () => void; openViewings: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            {active && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-sidebar-primary" aria-hidden />}
            <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "opacity-70")} aria-hidden />
            <span className="flex-1">{label}</span>
            {href === "/dashboard/viewings" && openViewings > 0 && (
              <span className="rounded-full bg-brass/90 px-1.5 text-[0.65rem] leading-4 font-semibold text-charcoal" aria-label={`${openViewings} open requests`}>
                {openViewings}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ organisationName, onNavigate, openViewings, isSample }: { organisationName: string; onNavigate?: () => void; openViewings: number; isSample: boolean }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 pt-6 pb-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Clannco overview">
          <Logo />
        </Link>
      </div>
      <div className="mx-6 mb-5 border-t border-sidebar-border pt-4">
        <div className="eyebrow text-[0.62rem] text-sidebar-foreground/50">Workspace</div>
        <div className="mt-1 truncate text-sm font-medium text-sidebar-accent-foreground">{organisationName}</div>
        {isSample && <div className="mt-1 text-[0.68rem] text-brass">Sample workspace · fictional data</div>}
      </div>
      <NavLinks onNavigate={onNavigate} openViewings={openViewings} />
      <div className="mt-auto px-6 py-5 text-[0.68rem] leading-relaxed text-sidebar-foreground/45">
        Property engagement platform
      </div>
    </div>
  );
}

export function Sidebar(props: { organisationName: string; openViewings: number; isSample: boolean }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
      <SidebarBody {...props} />
    </aside>
  );
}

export function MobileNav(props: { organisationName: string; openViewings: number; isSample: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-sidebar-border p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody {...props} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
