// REPO PATH: src/app/market-data/page.tsx  (REPLACE EXISTING)
// The audit tool and the market data are unified on / now. This route
// permanent-redirects so existing links / bookmarks still work.
import { permanentRedirect } from "next/navigation";

export default function Page(): never {
  permanentRedirect("/");
}
