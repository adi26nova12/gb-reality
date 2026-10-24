"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/app/field";
import { MediaUploader, type UploadedFile } from "@/components/app/media-uploader";
import { ActionButton } from "@/components/app/action-button";
import { addBrochure, updateBrochure } from "@/server/actions/catalogue";
import { mediaUrl } from "@/lib/media";
import { formatDate } from "@/lib/domain/dates";
import type { Brochure } from "@/lib/types";

export function BrochureManager({ developmentId, brochures, mediaPrefix }: { developmentId: string; brochures: Brochure[]; mediaPrefix: string }) {
  const router = useRouter();
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [title, setTitle] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);
  const [pending, startTransition] = useTransition();
  const active = brochures.filter((b) => !b.archivedAt);

  const save = () =>
    startTransition(async () => {
      if (!file) return;
      const result = await addBrochure({ developmentId, title: title || file.name.replace(/\.pdf$/i, ""), storagePath: file.path, fileSizeBytes: file.size, allowDownload });
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Brochure added");
      setFile(null);
      setTitle("");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">No brochure yet. Microsites show a polished “brochure coming soon” state until one is added.</p>
      ) : (
        <ul className="divide-y divide-border">
          {active.map((b, i) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
              <FileText className="size-4 text-brass" aria-hidden />
              <div className="min-w-0 flex-1">
                <a href={mediaUrl(b.storagePath) ?? "#"} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
                  {b.title}
                </a>
                <div className="text-xs text-muted-foreground">
                  {(b.fileSizeBytes / 1024 / 1024).toFixed(1)} MB · added {formatDate(b.createdAt)}
                  {i === 0 && " · shown on microsites"}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={b.allowDownload}
                  onCheckedChange={(v) =>
                    startTransition(async () => {
                      const r = await updateBrochure(b.id, { allowDownload: v });
                      if (!r.ok) toast.error(r.error);
                      router.refresh();
                    })
                  }
                  aria-label="Allow buyers to download"
                />
                Allow download
              </label>
              <ActionButton
                variant="ghost"
                size="sm"
                action={() => updateBrochure(b.id, { archived: true })}
                confirm={{ title: "Remove this brochure from microsites?", description: "It will be archived and no longer shown to buyers.", confirmLabel: "Archive brochure" }}
              >
                Archive
              </ActionButton>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-border p-4">
        <div className="mb-3 text-sm font-medium">Add a brochure</div>
        {file ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field id="brochure-title" label="Title" hint={`${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB uploaded`}>
              <Input id="brochure-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={file.name.replace(/\.pdf$/i, "")} />
            </Field>
            <label className="flex items-center gap-2 pb-2 text-xs">
              <Switch checked={allowDownload} onCheckedChange={setAllowDownload} /> Allow download
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={save} disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Save brochure
              </Button>
              <Button variant="ghost" onClick={() => setFile(null)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <MediaUploader kind="brochures" mediaPrefix={mediaPrefix} value={[]} onChange={() => undefined} onUploaded={setFile} label="Upload PDF brochure" />
        )}
      </div>
    </div>
  );
}
