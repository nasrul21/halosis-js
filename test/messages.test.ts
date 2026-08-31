import { describe, expect, it, vi } from "vitest";

import { Halosis } from "../src/index.js";

function createClient(): { client: Halosis; fetchMock: ReturnType<typeof vi.fn<typeof fetch>> } {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(() =>
      Promise.resolve(Response.json({ status: "success", wam_id: "wamid.example" })),
    );
  return {
    client: new Halosis({ accessToken: "access-token", fetch: fetchMock }),
    fetchMock,
  };
}

describe("MessagesResource", () => {
  it("exposes template sending as a messages convenience method", async () => {
    const { client, fetchMock } = createClient();

    await client.messages.sendTemplate({
      to: "628222222222",
      templateName: "welcome",
      languageCode: "id",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends a text message", async () => {
    const { client, fetchMock } = createClient();

    const result = await client.messages.sendText({
      fromPhoneNumber: "628111111111",
      to: "628222222222",
      message: "Hello World",
    });

    expect(result).toEqual({ status: "success", wamId: "wamid.example" });
    expectRequestBody(fetchMock, {
      from_phone_number: "628111111111",
      to: "628222222222",
      type: "text",
      message: "Hello World",
    });
  });

  it.each([
    ["image", "sendImage"],
    ["video", "sendVideo"],
  ] as const)("sends a %s message", async (type, method) => {
    const { client, fetchMock } = createClient();

    await client.messages[method]({
      fromPhoneNumber: "628111111111",
      to: "628222222222",
      message: "Media caption",
      url: `https://example.com/media.${type}`,
    });

    expectRequestBody(fetchMock, {
      from_phone_number: "628111111111",
      to: "628222222222",
      type,
      message: "Media caption",
      url: `https://example.com/media.${type}`,
    });
  });

  it("omits an unspecified media caption", async () => {
    const { client, fetchMock } = createClient();

    await client.messages.sendImage({
      fromPhoneNumber: "628111111111",
      to: "628222222222",
      url: "https://example.com/image.png",
    });

    expectRequestBody(fetchMock, {
      from_phone_number: "628111111111",
      to: "628222222222",
      type: "image",
      url: "https://example.com/image.png",
    });
  });

  it("sends a document message", async () => {
    const { client, fetchMock } = createClient();

    await client.messages.sendDocument({
      fromPhoneNumber: "628111111111",
      to: "628222222222",
      message: "Invoice",
      url: "https://example.com/invoice.pdf",
      filename: "invoice.pdf",
    });

    expectRequestBody(fetchMock, {
      from_phone_number: "628111111111",
      to: "628222222222",
      type: "document",
      message: "Invoice",
      url: "https://example.com/invoice.pdf",
      filename: "invoice.pdf",
    });
  });

  it("sends an audio message", async () => {
    const { client, fetchMock } = createClient();

    await client.messages.sendAudio({
      fromPhoneNumber: "628111111111",
      to: "628222222222",
      url: "https://example.com/audio.mp3",
    });

    expectRequestBody(fetchMock, {
      from_phone_number: "628111111111",
      to: "628222222222",
      type: "audio",
      url: "https://example.com/audio.mp3",
    });
  });

  it.each([
    ["fromPhoneNumber", { fromPhoneNumber: "", to: "628222222222", message: "Hello" }],
    ["to", { fromPhoneNumber: "628111111111", to: "", message: "Hello" }],
    ["message", { fromPhoneNumber: "628111111111", to: "628222222222", message: "" }],
  ])("rejects an empty %s", async (field, params) => {
    const { client } = createClient();

    await expect(client.messages.sendText(params)).rejects.toThrow(`${field} cannot be empty`);
  });

  it("rejects a malformed successful response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: "success" }));
    const client = new Halosis({ accessToken: "access-token", fetch: fetchMock });

    await expect(
      client.messages.sendText({
        fromPhoneNumber: "628111111111",
        to: "628222222222",
        message: "Hello",
      }),
    ).rejects.toThrow("Halosis API response is missing wam_id");
  });
});

function expectRequestBody(
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  expected: Record<string, unknown>,
): void {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  expect(url).toBe("https://api.halosis.id/v1/messages");
  expect(typeof init?.body).toBe("string");
  const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
  expect(body).toEqual(expected);
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer access-token");
}
