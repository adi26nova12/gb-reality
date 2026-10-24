"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-20 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-[#fbeceb] text-destructive">
        <TriangleAlert className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold">This page could not be loaded</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        The data service did not respond as expected. Your data has not been changed. Try again, and if the problem continues check the
        Supabase connection.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
