import { describe, expect, it, vi } from "vitest";

import { Halosis } from "../src/index.js";

describe("TemplateMessagesResource", () => {
  it("sends a parameterized template with header, body, button, and ref code", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: "success", wam_id: "wamid.template" }));
    const client = new Halosis({ accessToken: "access-token", fetch: fetchMock });

    const result = await client.templateMessages.send({
      fromPhoneNumber: "628111111111",
      to: "628222222222",
      templateName: "order_confirmation",
      languageCode: "id",
      header: { type: "image", url: "https://example.com/order.png" },
      bodyParameters: ["Andi", "INV-001"],
      buttons: [{ subType: "URL", index: 0, parameter: "orders/INV-001" }],
      refCode: "order_001",
    });

    expect(result).toEqual({ status: "success", wamId: "wamid.template" });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(parseJsonBody(init?.body)).toEqual({
      from_phone_number: "628111111111",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "628222222222",
      type: "template",
      ref_code: "order_001",
      template: {
        name: "order_confirmation",
        language: { code: "id" },
        components: [
          {
            type: "header",
            parameters: [{ type: "image", image: { link: "https://example.com/order.png" } }],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: "Andi" },
              { type: "text", text: "INV-001" },
            ],
          },
          {
            type: "button",
            sub_type: "URL",
            index: "0",
            parameters: [{ type: "text", text: "orders/INV-001" }],
          },
        ],
      },
    });
  });

  it("supports a parameterless template without a sender", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: "success", wam_id: "wamid.template" }));
    const client = new Halosis({ accessToken: "access-token", fetch: fetchMock });

    await client.templateMessages.send({
      to: "628222222222",
      templateName: "welcome",
      languageCode: "id",
    });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(parseJsonBody(init?.body)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "628222222222",
      type: "template",
      template: { name: "welcome", language: { code: "id" } },
    });
  });

  it("supports media headers and document filenames", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: "success", wam_id: "wamid.template" }));
    const client = new Halosis({ fetch: fetchMock });

    await client.templateMessages.send({
      to: "628222222222",
      templateName: "invoice",
      languageCode: "en",
      header: { type: "document", url: "https://example.com/invoice.pdf", filename: "invoice.pdf" },
    });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(parseJsonBody(init?.body)).toMatchObject({
      template: {
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "document",
                document: { link: "https://example.com/invoice.pdf", filename: "invoice.pdf" },
              },
            ],
          },
        ],
      },
    });
  });

  it.each(["has space", "a".repeat(25), "bad.value"])(
    "rejects invalid ref codes: %s",
    async (refCode) => {
      const client = new Halosis({ fetch: vi.fn<typeof fetch>() });

      await expect(
        client.templateMessages.send({
          to: "628222222222",
          templateName: "welcome",
          languageCode: "id",
          refCode,
        }),
      ).rejects.toThrow("refCode must be at most 24 characters");
    },
  );

  it("rejects empty required values", async () => {
    const client = new Halosis({ fetch: vi.fn<typeof fetch>() });

    await expect(
      client.templateMessages.send({
        to: "",
        templateName: "welcome",
        languageCode: "id",
      }),
    ).rejects.toThrow("to cannot be empty");
  });
});

function parseJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") {
    throw new TypeError("Expected a JSON request body");
  }

  return JSON.parse(body) as unknown;
}
