export function getBackendBase(): string {
  const configuredUrl = process.env.BACKEND_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return process.env.NODE_ENV === "development" ? "http://localhost:9000" : "";
}
