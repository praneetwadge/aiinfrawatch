// @ts-nocheck
import CostAuditClient from "./CostAuditClient";

export const metadata = {
  title: "AIInfraWatch — See what you're overpaying for AI compute",
  description:
    "Paste your setup and see your estimated GPU overpayment against today's reliable market floor — no sign-in. Email only to unlock the migration plan.",
  robots: "index, follow",
};

export default function Page() {
  return <CostAuditClient />;
}
