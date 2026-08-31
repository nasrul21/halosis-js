import { describe, expect, it, vi } from "vitest";

import { Halosis, HalosisError } from "../src/index.js";

describe("HalosisError", () => {
  it("preserves API error context", async () => {
    const body = {
      code: "VALIDATION_ERROR",
      message: {
        images: ["The images must not be greater than 5 characters."],
      },
      status: false,
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(body, {
        status: 422,
        headers: {
          "retry-after": "30",
          "x-request-id": "request-123",
        },
      }),
    );
    const client = new Halosis({ fetch: fetchMock });

    const error = await client
      .request("POST", "/v1/products", { body: {} })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HalosisError);
    expect(error).toMatchObject({
      name: "HalosisError",
      message: "Halosis API validation failed",
      status: 422,
      code: "VALIDATION_ERROR",
      details: body.message,
      body,
      method: "POST",
      url: "https://api.halosis.id/v1/products",
      requestId: "request-123",
      retryAfter: "30",
      isRetryable: false,
    });
    expect((error as HalosisError).response.status).toBe(422);
    expect((error as HalosisError).headers.get("x-request-id")).toBe("request-123");
    expect((error as HalosisError).cause).toEqual(body);
  });

  it.each([
    [401, "Halosis API authentication failed", false],
    [403, "Halosis API permission denied", false],
    [404, "Halosis API resource not found", false],
    [429, "Halosis API rate limit exceeded", true],
    [503, "Halosis API server error", true],
  ])("normalizes a %s response", async (status, message, isRetryable) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    const client = new Halosis({ fetch: fetchMock });

    const error = await client.request("GET", "/failure").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HalosisError);
    expect(error).toMatchObject({ status, message, isRetryable });
  });

  it("uses a server-provided message and validation errors", async () => {
    const errors = { email: ["The email field is required."] };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ message: "Invalid request", errors }, { status: 422 }));
    const client = new Halosis({ fetch: fetchMock });

    const error = await client.request("POST", "/invalid").catch((reason: unknown) => reason);

    expect(error).toMatchObject({ message: "Invalid request", details: errors });
  });
});
