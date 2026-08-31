import { describe, expect, it, vi } from "vitest";

import { Halosis } from "../src/client.js";
import { HalosisError } from "../src/errors.js";

describe("HTTP transport", () => {
  it("sends an authenticated request and parses JSON", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ status: true }, { headers: { "x-request-id": "request-1" } }),
      );
    const client = new Halosis({
      accessToken: "secret",
      fetch: fetchMock,
      headers: { "x-sdk-test": "default" },
    });

    const result = await client.request<{ status: boolean }>("POST", "/v1/messages", {
      body: { message: "Hello" },
      headers: { "x-sdk-test": "request" },
      query: {
        active: true,
        empty: undefined,
        page: 2,
        tag: ["one", "two"],
      },
    });

    expect(result).toEqual({ status: true });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.halosis.id/v1/messages?active=true&page=2&tag=one&tag=two");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"message":"Hello"}');

    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer secret");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-sdk-test")).toBe("request");
  });

  it("can send an unauthenticated request", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }));
    const client = new Halosis({ accessToken: "secret", fetch: fetchMock });

    await client.request("POST", "/v1/login", {
      authenticated: false,
      body: { email: "user@example.com", password: "secret" },
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it("returns text and empty responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("accepted"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new Halosis({ fetch: fetchMock });

    await expect(client.request("GET", "/text")).resolves.toBe("accepted");
    await expect(client.request("DELETE", "/empty")).resolves.toBeUndefined();
  });

  it("encodes multipart fields and files", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: true }));
    const client = new Halosis({
      accessToken: "secret",
      fetch: fetchMock,
      headers: { "content-type": "application/json" },
    });
    const image = new Blob(["image data"], { type: "image/png" });

    await client.request("POST", "/v1/products", {
      form: {
        "category_id[]": [18070, 18083],
        "images[]": { data: image, filename: "product.png" },
        name: "Example product",
        optional: undefined,
        "warehouses[0][id_warehouse]": 1414,
      },
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    const form = init?.body;

    expect(headers.has("content-type")).toBe(false);
    expect(form).toBeInstanceOf(FormData);

    const formData = form as FormData;
    expect(formData.getAll("category_id[]")).toEqual(["18070", "18083"]);
    expect(formData.get("name")).toBe("Example product");
    expect(formData.get("warehouses[0][id_warehouse]")).toBe("1414");
    expect(formData.has("optional")).toBe(false);

    const uploadedImage = formData.get("images[]") as Blob & { name: string };
    expect(uploadedImage).toBeInstanceOf(Blob);
    expect(uploadedImage.name).toBe("product.png");
    expect(uploadedImage.type).toBe("image/png");
  });

  it("accepts an existing FormData instance", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: true }));
    const client = new Halosis({ fetch: fetchMock });
    const form = new FormData();
    form.append("name", "Example product");

    await client.request("POST", "/v1/products", { form });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.body).toBe(form);
  });

  it("rejects conflicting body types", async () => {
    const client = new Halosis({ fetch: vi.fn<typeof fetch>() });

    await expect(
      client.request("POST", "/v1/products", { body: {}, form: new FormData() }),
    ).rejects.toThrow("body and form cannot be used together");
  });

  it("rejects unsuccessful responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ message: "Invalid request" }, { status: 422 }));
    const client = new Halosis({ fetch: fetchMock });

    await expect(client.request("POST", "/invalid", { body: {} })).rejects.toMatchObject({
      name: "HalosisError",
      message: "Invalid request",
      status: 422,
    } satisfies Partial<HalosisError>);
  });

  it("rejects absolute paths and GET request bodies", async () => {
    const client = new Halosis({ fetch: vi.fn<typeof fetch>() });

    await expect(client.request("GET", "https://example.com/data")).rejects.toThrow(
      "path must be relative",
    );
    await expect(client.request("GET", "/v1/messages", { body: {} })).rejects.toThrow(
      "GET requests cannot include a body",
    );
  });

  it("forwards cancellation to fetch", async () => {
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const reason = init.signal?.reason as unknown;
            reject(reason instanceof Error ? reason : new Error("Request aborted"));
          },
          { once: true },
        );
      });
    });
    const client = new Halosis({ fetch: fetchMock });
    const controller = new AbortController();
    const request = client.request("GET", "/v1/messages", { signal: controller.signal });

    controller.abort(new Error("Cancelled by caller"));

    await expect(request).rejects.toThrow("Cancelled by caller");
  });
});
