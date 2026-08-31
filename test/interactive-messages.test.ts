import { describe, expect, it, vi } from "vitest";

import { Halosis } from "../src/index.js";

describe("InteractiveMessagesResource", () => {
  it("sends list replies", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: "success", wam_id: "wamid.list" }));
    const client = new Halosis({ accessToken: "token", fetch: fetchMock });

    await client.messages.sendListReply({
      fromPhoneNumber: "628111111111",
      to: "628222222222",
      message: "Choose one",
      listTitle: "Products",
      lists: [{ id: "one", title: "One", description: "First product" }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ type: "list", list_title: "Products" });
    expect(body.lists).toEqual([{ id: "one", title: "One", description: "First product" }]);
  });

  it("sends buttons, CTA URLs, location requests, and flows", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ status: "success", wam_id: "wamid.interactive" })),
      );
    const client = new Halosis({ accessToken: "token", fetch: fetchMock });
    const recipient = { fromPhoneNumber: "628111111111", to: "628222222222" };

    await client.interactiveMessages.sendButtonReply({
      ...recipient,
      message: "Choose",
      buttons: [{ id: "yes", title: "Yes" }],
      header: { type: "image", value: "https://example.com/header.png" },
    });
    await client.messages.sendCtaUrl({
      ...recipient,
      message: "Visit",
      buttonLabel: "Open",
      buttonUrl: "https://example.com",
    });
    await client.messages.sendLocationRequest({ ...recipient, message: "Share location" });
    await client.messages.sendFlow({ ...recipient, message: "Complete form", flowId: "flow-1" });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      type: "cta_url",
    });
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)).toMatchObject({
      type: "location_request_message",
      buttons: [{ name: "send_location" }],
    });
    expect(JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string)).toMatchObject({
      type: "flow",
      flow_id: "flow-1",
    });
  });

  it("supports arbitrary interactive payloads", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: "success", wam_id: "wamid.custom" }));
    const client = new Halosis({ fetch: fetchMock });

    await client.messages.sendInteractive({
      fromPhoneNumber: "628111111111",
      to: "628222222222",
      type: "custom_interactive",
      payload: { message: "Custom", custom_field: true },
    });

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      type: "custom_interactive",
      custom_field: true,
    });
  });
});
