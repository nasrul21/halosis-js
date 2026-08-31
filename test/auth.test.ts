import { describe, expect, it, vi } from "vitest";

import { Halosis, HalosisError } from "../src/index.js";

describe("AuthResource", () => {
  it("logs in and maps the refresh token response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        message: "success",
        refresh_token: "refresh-token",
        token_expired_at: "Tue, 18 Apr 2023 10:02:52",
        login_at: "Mon, 17 Apr 2023 10:02:52",
      }),
    );
    const client = new Halosis({ accessToken: "existing-token", fetch: fetchMock });

    const result = await client.auth.login({
      email: "user@example.com",
      password: "password",
    });

    expect(result).toEqual({
      message: "success",
      refreshToken: "refresh-token",
      tokenExpiresAt: "Tue, 18 Apr 2023 10:02:52",
      loginAt: "Mon, 17 Apr 2023 10:02:52",
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.halosis.id/v1/login");
    expect(init?.body).toBe('{"email":"user@example.com","password":"password"}');
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it("exchanges a refresh token for a long-lived access token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        message: "success",
        long_lived_token: "long-lived-token",
        token_expired_at: "Fri, 16 Jun 2023 10:04:57",
      }),
    );
    const client = new Halosis({ fetch: fetchMock });

    const result = await client.auth.exchangeRefreshToken({ refreshToken: "refresh-token" });

    expect(result).toEqual({
      message: "success",
      accessToken: "long-lived-token",
      tokenExpiresAt: "Fri, 16 Jun 2023 10:04:57",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"refresh_token":"refresh-token"}');
  });

  it.each([
    ["email", { email: "", password: "password" }],
    ["password", { email: "user@example.com", password: " " }],
  ])("rejects an empty %s", async (field, params) => {
    const client = new Halosis({ fetch: vi.fn<typeof fetch>() });

    await expect(client.auth.login(params)).rejects.toThrow(`${field} cannot be empty`);
  });

  it("rejects an empty refresh token", async () => {
    const client = new Halosis({ fetch: vi.fn<typeof fetch>() });

    await expect(client.auth.exchangeRefreshToken({ refreshToken: "" })).rejects.toThrow(
      "refreshToken cannot be empty",
    );
  });

  it("preserves typed API failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ message: "IP not registered" }, { status: 401 }));
    const client = new Halosis({ fetch: fetchMock });

    await expect(
      client.auth.login({ email: "user@example.com", password: "password" }),
    ).rejects.toBeInstanceOf(HalosisError);
  });

  it("rejects a malformed successful response", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ message: "success" }));
    const client = new Halosis({ fetch: fetchMock });

    await expect(
      client.auth.login({ email: "user@example.com", password: "password" }),
    ).rejects.toThrow("Halosis API response is missing refresh_token");
  });
});
