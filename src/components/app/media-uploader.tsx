"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { FileText, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBrowserClient } from "@/lib/supabase/client";
import { mediaUrl } from "@/lib/media";
import { IMAGE_MIME_TYPES, MAX_BROCHURE_BYTES, MAX_IMAGE_BYTES, MEDIA_BUCKET } from "@/lib/domain/constants";

type Kind = "images" | "floor-plans" | "brochures";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

export interface UploadedFile {
  path: string;
  size: number;
  name: string;
}

function rules(kind: Kind, allowPdf: boolean) {
  if (kind === "brochures") return { types: ["application/pdf"], max: MAX_BROCHURE_BYTES, label: "PDF up to 25 MB" };
  const types: string[] = [...IMAGE_MIME_TYPES];
  if (allowPdf) types.push("application/pdf");
  return { types, max: MAX_IMAGE_BYTES, label: `${allowPdf ? "JPG, PNG, WebP or PDF" : "JPG, PNG or WebP"} up to 10 MB` };
}

/**
 * Uploads straight from the browser to Supabase Storage using the agent's own
 * session. Storage policies only allow writes inside the organisation's folder.
 */
export function MediaUploader({
  kind,
  mediaPrefix,
  value,
  onChange,
  multiple = false,
  allowPdf = false,
  onUploaded,
  label,
}: {
  kind: Kind;
  mediaPrefix: string;
  value: string[];
  onChange: (paths: string[]) => void;
  multiple?: boolean;
  allowPdf?: boolean;
  onUploaded?: (file: UploadedFile) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const { types, max, label: hint } = rules(kind, allowPdf);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, multiple ? 12 : 1);
    const added: string[] = [];
    setUploading(list.length);
    for (const file of list) {
      if (!types.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type. Use ${hint}.`);
        setUploading((n) => n - 1);
        continue;
      }
      if (file.size > max) {
        toast.error(`${file.name} is too large (${hint}).`);
        setUploading((n) => n - 1);
        continue;
      }
      const path = `${mediaPrefix}/${kind}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
      try {
        const { error } = await getBrowserClient().storage.from(MEDIA_BUCKET).upload(path, file, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
        if (error) throw error;
        added.push(path);
        onUploaded?.({ path, size: file.size, name: file.name });
      } catch {
        toast.error(`${file.name} could not be uploaded. Check your connection and that storage is configured.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onChange(multiple ? [...value, ...added] : added.slice(0, 1));
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && kind !== "brochures" && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((path) => {
            const src = mediaUrl(path);
            const isPdf = path.endsWith(".pdf");
            return (
              <li key={path} className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                {isPdf || !src ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <FileText className="size-6" aria-label="PDF file" />
                  </div>
                ) : (
                  <Image src={src} alt="" fill sizes="160px" className="object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((p) => p !== path))}
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-charcoal/80 text-white opacity-90 transition hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Remove file"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={types.join(",")}
        multiple={multiple}
        onChange={(e) => upload(e.target.files)}
        aria-label={label ?? "Upload file"}
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading > 0} onClick={() => input.current?.click()}>
        {uploading > 0 ? <Loader2 className="animate-spin" aria-hidden /> : kind === "brochures" ? <FileText aria-hidden /> : <ImagePlus aria-hidden />}
        {uploading > 0 ? "Uploading…" : (label ?? (multiple ? "Upload images" : "Upload file"))}
      </Button>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
