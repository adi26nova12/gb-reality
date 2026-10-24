import Link from "next/link";
import { Bell, LogOut, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/server/actions/account";
import { MobileNav } from "./sidebar";
import { OrganisationSwitcher } from "./organisation-switcher";
import { cn } from "@/lib/utils";

export function Topbar({
  userName,
  email,
  organisationName,
  organisations,
  currentOrganisationId,
  unread,
  openViewings,
  isSample,
}: {
  userName: string;
  email: string | null;
  organisationName: string;
  organisations: { id: string; name: string }[];
  currentOrganisationId: string;
  unread: number;
  openViewings: number;
  isSample: boolean;
}) {
  const initials = userName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-8">
      <MobileNav organisationName={organisationName} openViewings={openViewings} isSample={isSample} />
      {organisations.length > 1 && <OrganisationSwitcher organisations={organisations} currentId={currentOrganisationId} />}
      <div className="ml-auto flex items-center gap-2">
        <Link href="/dashboard/enquiries/new" className={cn(buttonVariants({ size: "lg" }), "hidden sm:inline-flex")}>
          <Plus aria-hidden /> New Enquiry
        </Link>
        <Link
          href="/dashboard/notifications"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "relative")}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-4 rounded-full bg-emerald-brand px-1 text-center text-[0.6rem] leading-4 font-semibold text-ivory">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
              <span className="flex size-7 items-center justify-center rounded-full bg-charcoal text-[0.7rem] font-semibold text-champagne">
                {initials || "A"}
              </span>
              <span className="hidden max-w-32 truncate text-sm md:inline">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium">{userName}</div>
              {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut aria-hidden /> Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
