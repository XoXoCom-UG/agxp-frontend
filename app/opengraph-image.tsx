import { ImageResponse } from "next/og";
import { BRAND_MARK_SVG } from "@/components/layout/brand-logo";

// The card a shared link unfurls into. The default next/og font is used on
// purpose: the app's faces come through next/font as woff2, which next/og
// can't read, and shipping separate ttf copies for one image isn't worth it.
export const alt = "AgentiX Projects";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same words as the root metadata description in app/layout.tsx.
const DESCRIPTION =
  "Pair an AI consultant with an AI coach and talk to both about your transformation project. They ask the questions and produce the documents.";

const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(BRAND_MARK_SVG).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      // next/og lays out with inline styles only; there is no stylesheet here.
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 96px", background: "#060607", color: "#ECECEE",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={MARK_SRC} width={120} height={120} alt="" />
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: "-0.03em" }}>
            AgentiX Projects
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 44, maxWidth: 900, fontSize: 34, lineHeight: 1.45, color: "#A0A0A8" }}>
          {DESCRIPTION}
        </div>
      </div>
    ),
    { ...size },
  );
}
