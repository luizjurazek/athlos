import { renderAppIcon } from "@/app/utils/app-icon";

export function GET() {
  // Android may crop maskable icons to a circle (safe zone = inner 80%).
  return renderAppIcon({ size: 512, markScale: 0.8 });
}
