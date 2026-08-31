import { describe, expect, it, vi } from "vitest";

import { Halosis } from "../src/index.js";

describe("CarouselMessagesResource", () => {
  it("sends cards with media, body, dynamic URL, and quick reply parameters", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: "success", wam_id: "wamid.carousel" }));
    const client = new Halosis({ accessToken: "token", fetch: fetchMock });

    await client.messages.sendCarousel({
      to: "628222222222",
      templateName: "catalog",
      languageCode: "id",
      cards: [
        {
          header: { type: "image", url: "https://example.com/one.png" },
          bodyParameters: ["Product one"],
          buttons: [
            {
              subType: "quick_reply",
              index: 0,
              parameter: "product-one",
              parameterType: "payload",
            },
            { subType: "URL", index: 1, parameter: "products/one" },
          ],
        },
      ],
      bodyParameters: ["October catalog"],
    });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(typeof init?.body).toBe("string");
    const body = JSON.parse(init?.body as string) as {
      template: { components: unknown[] };
    };
    expect(body.template.components[0]).toMatchObject({
      type: "CAROUSEL",
      cards: [
        {
          card_index: 0,
          components: [
            { type: "HEADER", parameters: [{ type: "IMAGE" }] },
            { type: "BODY", parameters: [{ type: "TEXT", text: "Product one" }] },
            {
              type: "button",
              sub_type: "quick_reply",
              parameters: [{ type: "payload", payload: "product-one" }],
            },
            {
              type: "button",
              sub_type: "URL",
              parameters: [{ type: "text", text: "products/one" }],
            },
          ],
        },
      ],
    });
    expect(body.template.components[1]).toMatchObject({
      type: "body",
      parameters: [{ type: "text", text: "October catalog" }],
    });
  });

  it("rejects empty cards", async () => {
    const client = new Halosis({ fetch: vi.fn<typeof fetch>() });

    await expect(
      client.carouselMessages.send({
        to: "628222222222",
        templateName: "catalog",
        languageCode: "id",
        cards: [],
      }),
    ).rejects.toThrow("cards cannot be empty");
  });
});
