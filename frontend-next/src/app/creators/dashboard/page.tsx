import { redirect } from "next/navigation";

/**
 * Legacy creator-dashboard URL.
 *
 * The Creative Studio at /dashboard is the single creator workspace. Keep a
 * redirect here so old emails, bookmarks, and already-issued OAuth return
 * URLs cannot expose the retired dashboard.
 */
export default function LegacyCreatorDashboard() {
  redirect("/dashboard");
}
