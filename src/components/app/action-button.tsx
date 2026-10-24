"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/server/action-result";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * Runs a server action, shows the outcome as a toast and refreshes server
 * data. Pass `confirm` to require confirmation first (destructive actions).
 */
export function ActionButton({
  action,
  confirm,
  children,
  onDone,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & {
  action: () => Promise<ActionResult<unknown>>;
  confirm?: { title: string; description: React.ReactNode; confirmLabel: string; destructive?: boolean };
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        setOpen(false);
        router.refresh();
        onDone?.();
      } else {
        toast.error(result.error);
      }
    });

  const content = (
    <>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </>
  );

  if (!confirm) {
    return (
      <Button {...buttonProps} disabled={pending || buttonProps.disabled} onClick={run}>
        {content}
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button {...buttonProps} disabled={pending || buttonProps.disabled}>
          {content}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={confirm.destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={(e) => {
              e.preventDefault();
              run();
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirm.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
