export const POLAR_LINKS = {
  creator_go:
    process.env.NEXT_PUBLIC_POLAR_GO_URL ||
    "https://buy.polar.sh/polar_cl_oV9pu26KVXY5AL0EnxIejhiY7QGwAqDNOpI8u3oOGL5",
  creator_pro:
    process.env.NEXT_PUBLIC_POLAR_PRO_URL ||
    "https://buy.polar.sh/polar_cl_rz2IwXSHG15BCIlslVeArOIEchJevr6xEJn6u33tDli",
  creator_max:
    process.env.NEXT_PUBLIC_POLAR_MAX_URL ||
    "https://buy.polar.sh/polar_cl_a0EY6BIoTZ3GPMSiNIo1LU8EYRsMuHwM99TVU1zeGf7",
} as const;

export type PolarPlanKey = keyof typeof POLAR_LINKS;

/**
 * Returns the Polar checkout URL with customer email and user_id metadata attached.
 */
export function getPolarCheckoutUrl(
  plan: string,
  user?: { email?: string | null; id?: string | null } | null
): string {
  const normalized = (plan || "").trim().toLowerCase();
  let key: PolarPlanKey = "creator_pro";

  if (
    normalized === "go" ||
    normalized === "starter" ||
    normalized === "creator_go" ||
    normalized === "creator_starter"
  ) {
    key = "creator_go";
  } else if (
    normalized === "pro" ||
    normalized === "creator_pro" ||
    normalized === "pro studio"
  ) {
    key = "creator_pro";
  } else if (
    normalized === "max" ||
    normalized === "creator_max" ||
    normalized === "premium" ||
    normalized === "creator_premium" ||
    normalized === "agency"
  ) {
    key = "creator_max";
  }

  const raw = POLAR_LINKS[key] || POLAR_LINKS.creator_pro;
  try {
    const url = new URL(raw);
    if (user?.email) {
      url.searchParams.set("customer_email", user.email);
    }
    if (user?.id) {
      url.searchParams.set("metadata[user_id]", user.id);
    }
    return url.toString();
  } catch {
    return raw;
  }
}
