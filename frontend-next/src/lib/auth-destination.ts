export function safeAuthDestination(value: string | null | undefined): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

export function authPageHref(page: "/login" | "/signup", next: string | null): string {
  return next ? `${page}?${new URLSearchParams({ next })}` : page;
}
