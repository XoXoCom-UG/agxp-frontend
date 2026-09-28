import { ImageResponse } from "next/og";
import { BRAND_MARK_SVG } from "@/components/layout/brand-logo";

// The home-screen icon: the mark on the app's dark background, edge to edge.
// iOS rounds the corners itself, so no tile is drawn here.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(BRAND_MARK_SVG).toString("base64")}`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      // next/og lays out with inline styles only; there is no stylesheet here.
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#060607" }}>
        <img src={MARK_SRC} width={128} height={128} alt="" />
      </div>
    ),
    { ...size },
  );
}
