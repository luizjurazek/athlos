import { ImageResponse } from "next/og";

const BRAND_NAVY = "#132238";
const BRAND_ORANGE = "#FC6E20";

type AppIconOptions = {
  size: number;
  /** Fraction of the canvas the mark occupies; maskable icons need room for the OS crop. */
  markScale?: number;
};

/**
 * Renders the Athlos mark (same artwork as app/icon.svg) as a full-bleed PNG.
 * The background is square on purpose: iOS and Android apply their own corner mask,
 * so baked-in rounded corners would show up as dark edges.
 */
export function renderAppIcon({ size, markScale = 1 }: AppIconOptions) {
  const markSize = Math.round(size * markScale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_NAVY,
        }}
      >
        <svg width={markSize} height={markSize} viewBox="0 0 120 120" fill={BRAND_ORANGE}>
          <polygon points="24,90 36,90 54,54 48,42" />
          <polygon points="56,64 62,52 80,90 68,90" />
          <polygon points="64,46 70,34 96,90 84,90" />
          <polygon points="35,90 48,73 59,73 74,47 68,43 85,33 84,53 78,49 62,79 51,79 42,90" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
