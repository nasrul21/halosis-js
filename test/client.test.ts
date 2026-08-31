import { describe, expect, it, vi } from "vitest";

import { Halosis } from "../src/client.js";

describe("Halosis", () => {
  it("uses production defaults", () => {
    const client = new Halosis();

    expect(client.baseUrl).toBe("https://api.halosis.id");
    expect(client.timeout).toBe(30_000);
    expect(client.headers).toEqual({});
    expect(client.fetch).toBe(globalThis.fetch);
    expect(client.hasAccessToken).toBe(false);
  });

  it("normalizes custom configuration", () => {
    const customFetch = vi.fn<typeof fetch>();
    const client = new Halosis({
      accessToken: " token ",
      baseUrl: "https://example.com/api///",
      headers: { "X-Application": "example" },
      timeout: 5_000,
      fetch: customFetch,
    });

    expect(client.baseUrl).toBe("https://example.com/api");
    expect(client.timeout).toBe(5_000);
    expect(client.headers).toEqual({ "x-application": "example" });
    expect(client.fetch).toBe(customFetch);
    expect(client.hasAccessToken).toBe(true);
    expect(Object.isFrozen(client.headers)).toBe(true);
  });

  it.each(["", "   "])("rejects an empty access token", (accessToken) => {
    expect(() => new Halosis({ accessToken })).toThrow("accessToken cannot be empty");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid timeout: %s",
    (timeout) => {
      expect(() => new Halosis({ timeout })).toThrow("timeout must be a positive finite number");
    },
  );

  it.each([
    "not-a-url",
    "ftp://api.halosis.id",
    "https://user:password@api.halosis.id",
    "https://api.halosis.id?debug=true",
    "https://api.halosis.id#fragment",
  ])("rejects an invalid base URL: %s", (baseUrl) => {
    expect(() => new Halosis({ baseUrl })).toThrow(TypeError);
  });
});
