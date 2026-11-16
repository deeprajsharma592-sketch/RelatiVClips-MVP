/**
 * Subdomain and Host Routing Utilities for RelatiV Clips
 * 
 * Supports:
 * - Production: relativclips.com (marketing) and app.relativclips.com (creator studio)
 * - Local development: localhost:3005 (marketing / fallback) and app.localhost:3005 (subdomain test)
 */

export function isAppSubdomain(host?: string | null): boolean {
  if (typeof window !== "undefined" && !host) {
    host = window.location.host;
  }
  if (!host) return false;
  const cleanHost = host.toLowerCase().split(":")[0];
  return cleanHost === "app.relativclips.com" || cleanHost.startsWith("app.");
}

export function getAppDashboardUrl(path = ""): string {
  const cleanPath = path.startsWith("/") ? path : (path ? `/${path}` : "");
  
  // Client-side detection
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    
    // If already on app.relativclips.com or app.localhost, dashboard is at root "/"
    if (hostname === "app.relativclips.com" || hostname.startsWith("app.")) {
      return cleanPath || "/";
    }
    
    // In local development on standard localhost / 127.0.0.1
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `/dashboard${cleanPath === "/" ? "" : cleanPath}`;
    }
    
    // In production on relativclips.com or other domains
    return `https://app.relativclips.com${cleanPath || "/"}`;
  }
  
  // Server-side fallback
  if (process.env.NODE_ENV === "production") {
    return `https://app.relativclips.com${cleanPath || "/"}`;
  }
  return `/dashboard${cleanPath === "/" ? "" : cleanPath}`;
}

export function getMarketingUrl(path = "/"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === "app.relativclips.com") {
      return `https://relativclips.com${cleanPath}`;
    }
    if (hostname.startsWith("app.localhost")) {
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
