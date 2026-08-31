import { describe, expect, it, vi } from "vitest";

import { Halosis } from "../src/index.js";

describe("access token providers", () => {
  it("evaluates a provider before every authenticated request", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(Response.json({ status: true })));
    const tokens = ["first-token", "second-token"];
    const accessToken = vi.fn(() => tokens.shift());
    const client = new Halosis({ accessToken, fetch: fetchMock });

    await client.request("GET", "/first");
    await client.request("GET", "/second");

    expect(accessToken).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer first-token",
    );
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("authorization")).toBe(
      "Bearer second-token",
    );
  });

  it("supports asynchronous providers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: true }));
    const client = new Halosis({
      accessToken: async () => Promise.resolve(" async-token "),
      fetch: fetchMock,
    });

    await client.request("GET", "/resource");

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer async-token",
    );
  });

  it("allows a provider to return undefined", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: true }));
    const client = new Halosis({ accessToken: () => undefined, fetch: fetchMock });

    await client.request("GET", "/resource");

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("authorization")).toBe(false);
  });

  it("does not evaluate the provider for unauthenticated requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: true }));
    const accessToken = vi.fn(() => "token");
    const client = new Halosis({ accessToken, fetch: fetchMock });

    await client.request("POST", "/v1/login", { authenticated: false, body: {} });

    expect(accessToken).not.toHaveBeenCalled();
  });

  it.each(["", "   "])("rejects an empty provider token", async (token) => {
    const client = new Halosis({
      accessToken: () => token,
      fetch: vi.fn<typeof fetch>(),
    });

    await expect(client.request("GET", "/resource")).rejects.toThrow(
      "accessToken provider returned an empty token",
    );
  });

  it("propagates provider failures without sending a request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new Halosis({
      accessToken: () => {
        throw new Error("Token store unavailable");
      },
      fetch: fetchMock,
    });

    await expect(client.request("GET", "/resource")).rejects.toThrow("Token store unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
