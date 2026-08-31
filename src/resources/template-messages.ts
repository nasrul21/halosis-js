import type { HttpTransport } from "../http.js";

export interface TemplateHeaderText {
  type: "text";
  text: string;
}

export interface TemplateHeaderMedia {
  type: "image" | "video" | "document";
  url: string;
  filename?: string;
}

export type TemplateHeader = TemplateHeaderText | TemplateHeaderMedia;

export interface TemplateButton {
  /** WhatsApp button subtype, for example `URL` or `QUICK_REPLY`. */
  subType: string;
  /** Button index assigned by the approved Halosis template. */
  index: string | number;
  /** Optional dynamic text parameter for the button. */
  parameter?: string;
}

export interface SendTemplateParams {
  /** Optional WhatsApp Business sender number. */
  fromPhoneNumber?: string;
  /** Recipient phone number, including its country code. */
  to: string;
  templateName: string;
  languageCode: string;
  header?: TemplateHeader;
  bodyParameters?: readonly string[];
  buttons?: readonly TemplateButton[];
  /** Optional reference code (maximum 24 characters, no spaces). */
  refCode?: string;
}

export interface SendTemplateResult {
  status: string;
  wamId: string;
}

interface SendTemplateWireResponse {
  status: string;
  wam_id: string;
}

export class TemplateMessagesResource {
  readonly #transport: HttpTransport;

  constructor(transport: HttpTransport) {
    this.#transport = transport;
  }

  async send(params: SendTemplateParams): Promise<SendTemplateResult> {
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
        ...buildComponents(params),
      },
      ...(params.refCode === undefined ? {} : { ref_code: validateRefCode(params.refCode) }),
    };

    const response = await this.#transport.request<SendTemplateWireResponse>(
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

function buildComponents(params: SendTemplateParams): Record<string, unknown> {
  const components: Record<string, unknown>[] = [];

  if (params.header !== undefined) {
    components.push({
      type: "header",
      parameters: [buildHeaderParameter(params.header)],
    });
  }

  if (params.bodyParameters !== undefined) {
    components.push({
      type: "body",
      parameters: params.bodyParameters.map((text) => ({
        type: "text",
        text: requireNonEmpty("body parameter", text),
      })),
    });
  }

  for (const button of params.buttons ?? []) {
    components.push({
      type: "button",
      sub_type: requireNonEmpty("button subType", button.subType),
      index: String(button.index),
      ...(button.parameter === undefined
        ? {}
        : {
            parameters: [
              {
                type: "text",
                text: requireNonEmpty("button parameter", button.parameter),
              },
            ],
          }),
    });
  }

  return components.length === 0 ? {} : { components };
}

function buildHeaderParameter(header: TemplateHeader): Record<string, unknown> {
  if (header.type === "text") {
    return { type: "text", text: requireNonEmpty("header text", header.text) };
  }

  return {
    type: header.type,
    [header.type]: {
      link: requireNonEmpty("header URL", header.url),
      ...(header.type === "document" && header.filename !== undefined
        ? { filename: requireNonEmpty("header filename", header.filename) }
        : {}),
    },
  };
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
