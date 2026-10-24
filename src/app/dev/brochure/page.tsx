import type { Metadata } from "next";
import { BrochureViewer } from "@/components/microsite/brochure-viewer";
import { assertDevOnly } from "../sample";

export const metadata: Metadata = { title: "Brochure viewer preview (sample data)", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function DevBrochurePage() {
  assertDevOnly();
  return <BrochureViewer token={null} backHref="/dev/microsite" url="/dev/sample-brochure" title="Example Residences brochure (sample)" developmentName="Example Residences" allowDownload />;
}
