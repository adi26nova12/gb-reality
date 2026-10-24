import { afterEach, describe, expect, it } from "vitest";
import { getSiteUrl } from "@/lib/env";

const original = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe("getSiteUrl", () => {
  it("uses the configured public URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://homes.example.com/";
    expect(getSiteUrl("http://10.0.0.5:3000")).toBe("https://homes.example.com");
  });

  it("uses the device's address when the configured URL is localhost", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(getSiteUrl("http://10.12.137.124:3000")).toBe("http://10.12.137.124:3000");
    expect(getSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });
});
