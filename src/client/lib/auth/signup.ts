import { redirect } from "@tanstack/react-router";

export async function requireSignupEnabled() {
  let enabled = false;

  try {
    const response = await fetch("/api/signup-status", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.ok) {
      const status: unknown = await response.json();
      enabled =
        typeof status === "object" &&
        status !== null &&
        "enabled" in status &&
        status.enabled === true;
    }
  } catch {
    // A failed flag lookup must not expose a form that cannot be submitted.
  }

  if (!enabled) throw redirect({ to: "/signin", replace: true });
}
