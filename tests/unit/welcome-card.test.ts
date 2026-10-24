import { describe, expect, it } from "vitest";
import { fileSlug } from "@/server/welcome-card";

describe("welcome card download names", () => {
  it("are ASCII, lowercase and filesystem safe", () => {
    expect(fileSlug("Opus One", "Ahmed", "portrait")).toBe("opus-one-ahmed-portrait");
    expect(fileSlug("Opus One", 'Zoë "Z" <script>', "landscape")).toBe("opus-one-zoe-z-script-landscape");
    expect(fileSlug("", "")).toBe("welcome");
  });
});
