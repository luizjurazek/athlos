import { renderAppIcon } from "@/app/utils/app-icon";

export function GET() {
  return renderAppIcon({ size: 512 });
}
