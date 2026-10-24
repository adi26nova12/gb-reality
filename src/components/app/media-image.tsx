import Image from "next/image";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * Renders an uploaded image, or a quiet architectural placeholder when no
 * photograph has been uploaded yet (no stock imagery is substituted).
 */
export function MediaImage({
  path,
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
  label,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  label?: string;
}) {
  const src = mediaUrl(path);
  if (!src) {
    return (
      <div
        className={cn("relative flex items-center justify-center overflow-hidden bg-[#ece7dc]", className)}
        role="img"
        aria-label={`${alt} — image not yet uploaded`}
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(#d8cfbd 0.5px, transparent 0.5px), linear-gradient(90deg, #d8cfbd 0.5px, transparent 0.5px)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />
        <svg viewBox="0 0 200 120" className="absolute inset-0 m-auto h-1/2 w-1/2" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <path d="M70 92V52l30-22 30 22v40" fill="none" stroke="#b9a275" strokeWidth="1.2" />
          <path d="M88 92V70h24v22" fill="none" stroke="#b9a275" strokeWidth="1.2" />
        </svg>
        {label && <span className="absolute inset-x-0 bottom-3 text-center text-[0.62rem] font-medium tracking-[0.16em] text-[#8a7a58] uppercase">{label}</span>}
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
