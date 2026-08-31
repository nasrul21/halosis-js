import type { HttpTransport } from "../http.js";
import { TemplateMessagesResource } from "./template-messages.js";
import type { SendTemplateParams, SendTemplateResult } from "./template-messages.js";
import { CarouselMessagesResource } from "./carousel-messages.js";
import type { SendCarouselParams, SendCarouselResult } from "./carousel-messages.js";
import { InteractiveMessagesResource } from "./interactive-messages.js";
import type {
  SendButtonReplyParams,
  SendCtaUrlParams,
  SendFlowParams,
  SendInteractiveParams,
  SendInteractiveResult,
  SendListReplyParams,
  SendLocationRequestParams,
} from "./interactive-messages.js";

export interface MessageRecipient {
  /** Halosis WhatsApp sender number. */
  fromPhoneNumber: string;
  /** Recipient phone number, including its country code. */
  to: string;
}

export interface SendTextParams extends MessageRecipient {
  message: string;
}

export interface SendMediaParams extends MessageRecipient {
  /** Optional media caption. */
  message?: string;
  /** Publicly accessible media URL. */
  url: string;
}

export type SendImageParams = SendMediaParams;
export type SendVideoParams = SendMediaParams;

export interface SendDocumentParams extends SendMediaParams {
  filename: string;
}

export interface SendAudioParams extends MessageRecipient {
  /** Publicly accessible audio URL. */
  url: string;
}

export interface SendMessageResult {
  status: string;
  wamId: string;
}

interface SendMessageWireResponse {
  status: string;
  wam_id: string;
}

type MediaType = "image" | "video";

export class MessagesResource {
  readonly #transport: HttpTransport;
  readonly #templateMessages: TemplateMessagesResource;
  readonly #carouselMessages: CarouselMessagesResource;
  readonly #interactiveMessages: InteractiveMessagesResource;

  constructor(transport: HttpTransport) {
    this.#transport = transport;
    this.#templateMessages = new TemplateMessagesResource(transport);
    this.#carouselMessages = new CarouselMessagesResource(transport);
    this.#interactiveMessages = new InteractiveMessagesResource(transport);
  }

  /** Sends an approved WhatsApp template message. */
  sendTemplate(params: SendTemplateParams): Promise<SendTemplateResult> {
    return this.#templateMessages.send(params);
  }

  /** Sends a WhatsApp carousel template message. */
  sendCarousel(params: SendCarouselParams): Promise<SendCarouselResult> {
    return this.#carouselMessages.send(params);
  }

  sendListReply(params: SendListReplyParams): Promise<SendInteractiveResult> {
    return this.#interactiveMessages.sendListReply(params);
  }

  sendButtonReply(params: SendButtonReplyParams): Promise<SendInteractiveResult> {
    return this.#interactiveMessages.sendButtonReply(params);
  }

  sendCtaUrl(params: SendCtaUrlParams): Promise<SendInteractiveResult> {
    return this.#interactiveMessages.sendCtaUrl(params);
  }

  sendLocationRequest(params: SendLocationRequestParams): Promise<SendInteractiveResult> {
    return this.#interactiveMessages.sendLocationRequest(params);
  }

  sendFlow(params: SendFlowParams): Promise<SendInteractiveResult> {
    return this.#interactiveMessages.sendFlow(params);
  }

  sendInteractive(params: SendInteractiveParams): Promise<SendInteractiveResult> {
    return this.#interactiveMessages.send(params);
  }

  async sendText(params: SendTextParams): Promise<SendMessageResult> {
    return this.#send({
      ...recipientFields(params),
      type: "text",
      message: requireNonEmpty("message", params.message),
    });
  }

  async sendImage(params: SendImageParams): Promise<SendMessageResult> {
    return this.#sendMedia("image", params);
  }

  async sendVideo(params: SendVideoParams): Promise<SendMessageResult> {
    return this.#sendMedia("video", params);
  }

  async sendDocument(params: SendDocumentParams): Promise<SendMessageResult> {
    return this.#send({
      ...recipientFields(params),
      type: "document",
      url: requireNonEmpty("url", params.url),
      filename: requireNonEmpty("filename", params.filename),
      ...(params.message === undefined
        ? {}
        : { message: requireNonEmpty("message", params.message) }),
    });
  }

  async sendAudio(params: SendAudioParams): Promise<SendMessageResult> {
    return this.#send({
      ...recipientFields(params),
      type: "audio",
      url: requireNonEmpty("url", params.url),
    });
  }

  #sendMedia(type: MediaType, params: SendMediaParams): Promise<SendMessageResult> {
    return this.#send({
      ...recipientFields(params),
      type,
      url: requireNonEmpty("url", params.url),
      ...(params.message === undefined
        ? {}
        : { message: requireNonEmpty("message", params.message) }),
    });
  }

  async #send(body: Record<string, unknown>): Promise<SendMessageResult> {
    const response = await this.#transport.request<SendMessageWireResponse>(
      "POST",
      "/v1/messages",
      { body },
    );

    return {
      status: requireResponseString(response, "status"),
      wamId: requireResponseString(response, "wam_id"),
    };
  }
}

function recipientFields(params: MessageRecipient): Record<string, string> {
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
