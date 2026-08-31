import type { HttpTransport } from "../http.js";

export interface InteractiveRecipient {
  fromPhoneNumber: string;
  to: string;
}

export interface ListItem {
  id: string;
  title: string;
  description?: string;
}

export interface ButtonItem {
  id: string;
  title: string;
}

export interface InteractiveHeader {
  type: "text" | "image" | "video" | "document";
  value: string;
  filename?: string;
}

export interface SendListReplyParams extends InteractiveRecipient {
  message: string;
  listTitle: string;
  lists: readonly ListItem[];
}

export interface SendButtonReplyParams extends InteractiveRecipient {
  message: string;
  buttons: readonly ButtonItem[];
  header?: InteractiveHeader;
}

export interface SendCtaUrlParams extends InteractiveRecipient {
  message: string;
  buttonLabel: string;
  buttonUrl: string;
}

export interface SendLocationRequestParams extends InteractiveRecipient {
  message: string;
}

export interface SendFlowParams extends InteractiveRecipient {
  message: string;
  flowId: string;
}

export interface SendInteractiveParams extends InteractiveRecipient {
  type: string;
  /** Additional fields required by a Halosis interactive message type. */
  payload?: Readonly<Record<string, unknown>>;
}

export interface SendInteractiveResult {
  status: string;
  wamId: string;
}

interface WireResponse {
  status: string;
  wam_id: string;
}

export class InteractiveMessagesResource {
  readonly #transport: HttpTransport;

  constructor(transport: HttpTransport) {
    this.#transport = transport;
  }

  sendListReply(params: SendListReplyParams): Promise<SendInteractiveResult> {
    return this.#send({
      ...recipientFields(params),
      type: "list",
      message: requireNonEmpty("message", params.message),
      list_title: requireNonEmpty("listTitle", params.listTitle),
      lists: params.lists.map((item) => ({
        id: requireNonEmpty("list id", item.id),
        title: requireNonEmpty("list title", item.title),
        ...(item.description === undefined
          ? {}
          : { description: requireNonEmpty("list description", item.description) }),
      })),
    });
  }

  sendButtonReply(params: SendButtonReplyParams): Promise<SendInteractiveResult> {
    return this.#send({
      ...recipientFields(params),
      type: "button",
      message: requireNonEmpty("message", params.message),
      buttons: params.buttons.map((button) => ({
        id: requireNonEmpty("button id", button.id),
        title: requireNonEmpty("button title", button.title),
      })),
      ...(params.header === undefined ? {} : { header: buildHeader(params.header) }),
    });
  }

  sendCtaUrl(params: SendCtaUrlParams): Promise<SendInteractiveResult> {
    return this.#send({
      ...recipientFields(params),
      type: "cta_url",
      message: requireNonEmpty("message", params.message),
      button_label: requireNonEmpty("buttonLabel", params.buttonLabel),
      button_url: requireNonEmpty("buttonUrl", params.buttonUrl),
    });
  }

  sendLocationRequest(params: SendLocationRequestParams): Promise<SendInteractiveResult> {
    return this.#send({
      ...recipientFields(params),
      type: "location_request_message",
      message: requireNonEmpty("message", params.message),
      buttons: [{ name: "send_location" }],
    });
  }

  sendFlow(params: SendFlowParams): Promise<SendInteractiveResult> {
    return this.#send({
      ...recipientFields(params),
      type: "flow",
      message: requireNonEmpty("message", params.message),
      flow_id: requireNonEmpty("flowId", params.flowId),
    });
  }

  send(params: SendInteractiveParams): Promise<SendInteractiveResult> {
    return this.#send({
      ...recipientFields(params),
      ...params.payload,
      type: requireNonEmpty("type", params.type),
    });
  }

  async #send(body: Record<string, unknown>): Promise<SendInteractiveResult> {
    const response = await this.#transport.request<WireResponse>("POST", "/v1/messages", {
      body,
    });

    return {
      status: requireResponseString(response, "status"),
      wamId: requireResponseString(response, "wam_id"),
    };
  }
}

function buildHeader(header: InteractiveHeader): Record<string, unknown> {
  const value = requireNonEmpty("header value", header.value);
  if (header.type === "text") {
    return { type: "text", text: value };
  }

  return {
    type: header.type,
    [header.type]: {
      link: value,
      ...(header.type === "document" && header.filename !== undefined
        ? { filename: requireNonEmpty("header filename", header.filename) }
        : {}),
    },
  };
}

function recipientFields(params: InteractiveRecipient): Record<string, string> {
  return {
    from_phone_number: requireNonEmpty("fromPhoneNumber", params.fromPhoneNumber),
    to: requireNonEmpty("to", params.to),
  };
}

function requireNonEmpty(name: string, value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} cannot be empty`);
  }

  return value.trim();
}

function requireResponseString<T extends object>(value: T, key: keyof T): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new TypeError(`Halosis API response is missing ${String(key)}`);
  }

  return field;
}
