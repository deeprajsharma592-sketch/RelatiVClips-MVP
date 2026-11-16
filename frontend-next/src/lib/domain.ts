/**
 * Subdomain and Host Routing Utilities for RelatiV Clips
 * 
 * Supports:
 * - Production: relativclips.com (marketing) and studio.relativclips.com (creator studio / dashboard)
 *   (with dash.relativclips.com and app.relativclips.com supported as legacy aliases)
 * - Local development: localhost:3000 (marketing / fallback) and studio.localhost:3000 (subdomain test)
 */

export function isStudioSubdomain(host?: string | null): boolean {
  if (typeof window !== "undefined" && !host) {
    host = window.location.host;
  }
  if (!host) return false;
  const cleanHost = host.toLowerCase().split(":")[0];
  return (
    cleanHost === "studio.relativclips.com" ||
    cleanHost.startsWith("studio.") ||
    cleanHost === "dash.relativclips.com" ||
    cleanHost.startsWith("dash.") ||
    cleanHost === "app.relativclips.com" ||
    cleanHost.startsWith("app.")
  );
}

// Backward-compatible aliases
export const isDashSubdomain = isStudioSubdomain;
export const isAppSubdomain = isStudioSubdomain;

export function getStudioDashboardUrl(
  path = "",
  queryParams?: Record<string, string | null | undefined>
): string {
  const cleanPath = path.startsWith("/") ? path : (path ? `/${path}` : "");
  
  const buildQuery = (base: string) => {
    if (!queryParams) return base;
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        searchParams.set(k, v);
      }
    });
    const qs = searchParams.toString();
    if (!qs) return base;
    return base.includes("?") ? `${base}&${qs}` : `${base}?${qs}`;
  };

  // Client-side detection
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    
    // If already on studio.relativclips.com, dash.relativclips.com, or studio.localhost, dashboard is at root "/"
    if (
      hostname === "studio.relativclips.com" ||
      hostname.startsWith("studio.") ||
      hostname === "dash.relativclips.com" ||
      hostname.startsWith("dash.") ||
      hostname === "app.relativclips.com" ||
      hostname.startsWith("app.")
    ) {
      return buildQuery(cleanPath || "/");
    }
    
    // In local development on standard localhost / 127.0.0.1
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const port = window.location.port ? `:${window.location.port}` : "";
      return buildQuery(`/dashboard${cleanPath === "/" ? "" : cleanPath}`);
    }
    
    // In production on relativclips.com or other domains
    return buildQuery(`https://studio.relativclips.com${cleanPath || "/"}`);
  }
  
  // Server-side fallback
  if (process.env.NODE_ENV === "production") {
    return buildQuery(`https://studio.relativclips.com${cleanPath || "/"}`);
  }
  return buildQuery(`/dashboard${cleanPath === "/" ? "" : cleanPath}`);
}

// Backward-compatible aliases
export const getDashDashboardUrl = getStudioDashboardUrl;
export const getAppDashboardUrl = getStudioDashboardUrl;

export function getMarketingUrl(path = "/"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    if (
      hostname === "studio.relativclips.com" ||
      hostname === "dash.relativclips.com" ||
      hostname === "app.relativclips.com"
    ) {
      return `https://relativclips.com${cleanPath}`;
    }
    if (
      hostname.startsWith("studio.localhost") ||
      hostname.startsWith("dash.localhost") ||
      hostname.startsWith("app.localhost")
    ) {
      const port = window.location.port ? `:${window.location.port}` : "";
      return `http://localhost${port}${cleanPath}`;
    }
    return cleanPath;
  }
  if (process.env.NODE_ENV === "production") {
    return `https://relativclips.com${cleanPath}`;
  }
  return cleanPath;
}
