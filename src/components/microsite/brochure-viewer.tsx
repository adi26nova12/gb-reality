"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Expand, Loader2, Minimize, Minus, Plus, TriangleAlert } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button, buttonVariants } from "@/components/ui/button";
import { TrackerProvider, useTracker } from "./tracker";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

type ViewerProps = { token: string | null; backHref: string; url: string; title: string; developmentName: string; allowDownload: boolean };

function Viewer({ backHref, url, title, developmentName, allowDownload }: ViewerProps) {
  const { track } = useTracker();
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderTask = useRef<RenderTask | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rendering, setRendering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Only read after the document loads, so server and client markup still match.
  const [canFullscreen] = useState(() => typeof document !== "undefined" && Boolean(document.fullscreenEnabled));
  const [width, setWidth] = useState(0);

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loading = pdfjs.getDocument({ url });
        task = loading;
        const loaded = await loading.promise;
        if (cancelled) return;
        setDoc(loaded);
        setState("ready");
        track("brochure_opened");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [url, track]);

  // Track the closing of the viewer where the browser reports it.
  useEffect(() => {
    const onHide = () => track("brochure_closed");
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [track]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Render the current page to fit the available width, scaled by zoom.
  useEffect(() => {
    const c = canvas.current;
    if (!doc || !c || width === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        setRendering(true);
        const base = pdfPage.getViewport({ scale: 1 });
        const fit = Math.min(width, 1100) / base.width;
        const viewport = pdfPage.getViewport({ scale: fit * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        c.width = Math.floor(viewport.width * ratio);
        c.height = Math.floor(viewport.height * ratio);
        c.style.width = `${Math.floor(viewport.width)}px`;
        c.style.height = `${Math.floor(viewport.height)}px`;
        const task = pdfPage.render({ canvas: c, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
        renderTask.current = task;
        await task.promise;
      } catch (e) {
        if (!cancelled && (e as { name?: string })?.name !== "RenderingCancelledException") setState("error");
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTask.current?.cancel();
    };
  }, [doc, page, zoom, width]);

  // A page counts as viewed once it has been displayed for a moment.
  useEffect(() => {
    if (!doc) return;
    const t = setTimeout(() => track("brochure_page_viewed", { metadata: { page } }), 800);
    return () => clearTimeout(t);
  }, [doc, page, track]);

  const pages = doc?.numPages ?? 0;
  const go = (delta: number) => setPage((p) => Math.min(Math.max(1, p + delta), pages || 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.current?.requestFullscreen();
    } catch {
      /* not supported on this device */
    }
  };

  return (
    <div ref={container} className="flex min-h-screen flex-col bg-[#1b1f1d] text-ivory">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-charcoal/95 px-3 py-2.5 backdrop-blur sm:px-6">
        <Link href={backHref} onClick={() => track("brochure_closed")} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Back to your homes</span>
          <span className="sm:hidden">Back</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-[0.7rem] text-white/50">{developmentName}</div>
        </div>
        {allowDownload ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={() => track("brochure_download_requested")}
            className={buttonVariants({ variant: "ghost", size: "sm", className: "text-white/80 hover:bg-white/10 hover:text-white" })}
            aria-label="Download brochure"
          >
            <Download aria-hidden /> <span className="hidden sm:inline">Download</span>
          </a>
        ) : (
          <span className="w-10" aria-hidden />
        )}
      </header>

      <div ref={stage} className="relative flex flex-1 justify-center overflow-auto px-2 py-4 sm:px-6 sm:py-8">
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-sm text-white/60" role="status">
            <Loader2 className="size-6 animate-spin" aria-hidden /> Loading brochure…
          </div>
        )}
        {state === "error" && (
          <div className="flex max-w-sm flex-col items-center justify-center gap-3 py-32 text-center text-sm text-white/70" role="alert">
            <TriangleAlert className="size-6 text-brass" aria-hidden />
            <p>The brochure could not be displayed on this device.</p>
            {allowDownload && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-champagne underline">
                Open the PDF instead
              </a>
            )}
            <Link href={backHref} className="text-white/60 underline">
              Back to your homes
            </Link>
          </div>
        )}
        <canvas ref={canvas} className={state === "ready" ? "h-auto max-w-none rounded-sm bg-white shadow-2xl" : "hidden"} aria-label={`${title}, page ${page} of ${pages}`} role="img" />
        {rendering && state === "ready" && <Loader2 className="absolute top-6 right-6 size-5 animate-spin text-white/50" aria-hidden />}
      </div>

      {state === "ready" && (
        <nav aria-label="Brochure controls" className="sticky bottom-0 flex items-center justify-center gap-1 border-t border-white/10 bg-charcoal/95 px-3 py-2.5 backdrop-blur sm:gap-2">
          <Button variant="ghost" size="icon-lg" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(-1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="min-w-20 text-center text-sm tabular-nums" aria-live="polite">
            {page} / {pages}
          </span>
          <Button variant="ghost" size="icon-lg" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight />
          </Button>
          <span className="mx-1 h-5 w-px bg-white/15 sm:mx-2" aria-hidden />
          <Button variant="ghost" size="icon-lg" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
            <Minus />
          </Button>
          <button type="button" onClick={() => setZoom(1)} className="min-w-12 rounded px-1 text-xs text-white/70 tabular-nums hover:text-white" aria-label="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <Button variant="ghost" size="icon-lg" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
            <Plus />
          </Button>
          {canFullscreen && (
            <Button variant="ghost" size="icon-lg" className="text-white hover:bg-white/10 hover:text-white" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
              {fullscreen ? <Minimize /> : <Expand />}
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}

export function BrochureViewer(props: ViewerProps) {
  return (
    <TrackerProvider token={props.token} enabled={Boolean(props.token)}>
      <Viewer {...props} />
    </TrackerProvider>
  );
}
