import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Personalised welcome card: the development's cover image with the buyer's
 * first name set over it. Rendered on request, so personalising for a new
 * client costs nothing: no image generation per client.
 */

export type CardFormat = "landscape" | "portrait";

export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  // Link-preview size used by WhatsApp and most chat apps.
  landscape: { width: 1200, height: 630 },
  // 4:5 sits well in a WhatsApp chat as a sent photo.
  portrait: { width: 1080, height: 1350 },
};

// Fonts are bundled (SIL Open Font License) and read once per server instance.
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/CormorantGaramond-SemiBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Inter-Medium.ttf")),
]);

export interface WelcomeCardInput {
  firstName: string | null;
  developmentName: string;
  location?: string | null;
  imageUrl: string | null;
  format: CardFormat;
}

const CHAMPAGNE = "#e6d9bc";
const CHARCOAL = "#121614";

function nameSize(name: string, format: CardFormat): number {
  const base = format === "landscape" ? 132 : 150;
  if (name.length <= 8) return base;
  if (name.length <= 12) return Math.round(base * 0.8);
  return Math.round(base * 0.62);
}

export async function renderWelcomeCard(input: WelcomeCardInput, headers?: Record<string, string>): Promise<ImageResponse> {
  const [display, sans] = await fonts;
  const { width, height } = CARD_SIZES[input.format];
  const landscape = input.format === "landscape";
  const name = input.firstName?.trim().slice(0, 24) || null;

  return new ImageResponse(
    (
      <div style={{ width, height, display: "flex", position: "relative", backgroundColor: CHARCOAL, fontFamily: "Inter" }}>
        {input.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={input.imageUrl} alt="" width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            display: "flex",
            backgroundImage: landscape
              ? "linear-gradient(90deg, rgba(18,22,20,0.88) 0%, rgba(18,22,20,0.55) 38%, rgba(18,22,20,0) 68%)"
              : "linear-gradient(0deg, rgba(18,22,20,0.92) 0%, rgba(18,22,20,0.6) 32%, rgba(18,22,20,0) 58%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            // Satori rejects undefined style values, so each layout spells out its own box.
            ...(landscape
              ? { left: 72, right: 520, top: 0, bottom: 0, justifyContent: "center" }
              : { left: 72, right: 72, bottom: 96, justifyContent: "flex-end" }),
          }}
        >
          {/* Satori lays fragments out as rows, so every line is its own block. */}
          <div style={{ display: "flex", color: CHAMPAGNE, fontSize: landscape ? 20 : 24, letterSpacing: 6, textTransform: "uppercase" }}>
            {name ? "Prepared exclusively for" : "Your private selection"}
          </div>
          {name && (
            <div style={{ display: "flex", color: "#ffffff", fontFamily: "Cormorant", fontSize: nameSize(name, input.format), lineHeight: 1, marginTop: 14 }}>
              {name}
            </div>
          )}
          <div style={{ display: "flex", width: 120, height: 2, backgroundColor: "#a07c3b", marginTop: 28, marginBottom: 24 }} />
          <div style={{ display: "flex", color: "#ffffff", fontFamily: "Cormorant", fontSize: landscape ? 46 : 56, lineHeight: 1.1 }}>
            {`Welcome to ${input.developmentName}`}
          </div>
          {input.location && (
            <div style={{ display: "flex", color: "rgba(255,255,255,0.78)", fontSize: landscape ? 22 : 26, marginTop: 14 }}>{input.location}</div>
          )}
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Cormorant", data: display, style: "normal", weight: 600 },
        { name: "Inter", data: sans, style: "normal", weight: 500 },
      ],
      headers,
    },
  );
}

/** ASCII-only, filesystem-safe slug for download filenames. */
export function fileSlug(...parts: string[]): string {
  return (
    parts
      .join("-")
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "welcome"
  );
}
