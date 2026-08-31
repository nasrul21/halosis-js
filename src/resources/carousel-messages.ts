import type { HttpTransport } from "../http.js";

export interface CarouselCardHeader {
  type: "image" | "video";
  url: string;
}

export interface CarouselButton {
  subType: string;
  index: string | number;
  /** Text parameter for dynamic URLs or a payload for quick replies. */
  parameter?: string;
  parameterType?: "text" | "payload";
}

export interface CarouselCard {
  header: CarouselCardHeader;
  bodyParameters?: readonly string[];
  buttons?: readonly CarouselButton[];
}

export interface SendCarouselParams {
  fromPhoneNumber?: string;
  to: string;
  templateName: string;
  languageCode: string;
  cards: readonly CarouselCard[];
  bodyParameters?: readonly string[];
  refCode?: string;
}

export interface SendCarouselResult {
  status: string;
  wamId: string;
}

interface WireResponse {
  status: string;
  wam_id: string;
}

export class CarouselMessagesResource {
  readonly #transport: HttpTransport;

  constructor(transport: HttpTransport) {
    this.#transport = transport;
  }

  async send(params: SendCarouselParams): Promise<SendCarouselResult> {
    if (params.cards.length === 0) {
      throw new TypeError("cards cannot be empty");
    }

    const body = {
      ...(params.fromPhoneNumber === undefined
        ? {}
        : { from_phone_number: requireNonEmpty("fromPhoneNumber", params.fromPhoneNumber) }),
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: requireNonEmpty("to", params.to),
      type: "template",
      template: {
        name: requireNonEmpty("templateName", params.templateName),
        language: { code: requireNonEmpty("languageCode", params.languageCode) },
        components: [
          {
            type: "CAROUSEL",
            cards: params.cards.map((card, cardIndex) => buildCard(card, cardIndex)),
          },
          ...(params.bodyParameters === undefined
            ? []
            : [
                {
                  type: "body",
                  parameters: params.bodyParameters.map((text) => ({
                    type: "text",
                    text: requireNonEmpty("body parameter", text),
                  })),
                },
              ]),
        ],
      },
      ...(params.refCode === undefined ? {} : { ref_code: validateRefCode(params.refCode) }),
    };

    const response = await this.#transport.request<WireResponse>("POST", "/v1/messages", {
      body,
    });

    return {
      status: requireResponseString(response, "status"),
      wamId: requireResponseString(response, "wam_id"),
    };
  }
}

function buildCard(card: CarouselCard, cardIndex: number): Record<string, unknown> {
  const components: Record<string, unknown>[] = [
    {
      type: "HEADER",
      parameters: [
        {
          type: card.header.type.toUpperCase(),
          [card.header.type]: { link: requireNonEmpty("header URL", card.header.url) },
        },
      ],
    },
  ];

  if (card.bodyParameters !== undefined) {
    components.push({
      type: "BODY",
      parameters: card.bodyParameters.map((text) => ({
        type: "TEXT",
        text: requireNonEmpty("card body parameter", text),
      })),
    });
  }

  for (const button of card.buttons ?? []) {
    const parameterType = button.parameterType ?? "text";
    components.push({
      type: "button",
      sub_type: requireNonEmpty("button subType", button.subType),
      index: String(button.index),
      ...(button.parameter === undefined
        ? {}
        : {
            parameters: [
              parameterType === "payload"
                ? {
                    type: "payload",
                    payload: requireNonEmpty("button parameter", button.parameter),
                  }
                : { type: "text", text: requireNonEmpty("button parameter", button.parameter) },
            ],
          }),
    });
  }

  return { card_index: cardIndex, components };
}

function validateRefCode(value: string): string {
  const refCode = requireNonEmpty("refCode", value);
  if (refCode.length > 24 || !/^[A-Za-z0-9_-]+$/.test(refCode)) {
    throw new TypeError(
      "refCode must be at most 24 characters and contain only letters, numbers, _ or -",
    );
  }

  return refCode;
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
