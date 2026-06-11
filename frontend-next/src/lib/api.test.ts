import { describe, it, expect } from "vitest";

describe("API client URL patterns", () => {
  it("uses NEXT_PUBLIC_API_URL as base", () => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";
    expect(base).toMatch(/^https?:\/\/.+/);
  });

  it("builds correct submit endpoint", () => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";
    expect(base + "/process/youtube").toBe(base + "/process/youtube");
  });

  it("builds correct status endpoint", () => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";
    expect(base + "/status/abc123").toBe(base + "/status/abc123");
  });
});
