"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy",
  successMessage = "Copied to clipboard",
  ...props
}: { value: string; label?: string; successMessage?: string } & Omit<React.ComponentProps<typeof Button>, "onClick" | "value">) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Your browser blocked clipboard access. Select the text and copy it manually.");
    }
  }

  return (
    <Button variant="outline" {...props} onClick={copy}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {label}
    </Button>
  );
}
