import { HttpTransport } from "./http.js";
import type { AccessToken, HttpMethod, RequestOptions } from "./http.js";
import { AuthResource } from "./resources/auth.js";
import { MessagesResource } from "./resources/messages.js";
import { TemplateMessagesResource } from "./resources/template-messages.js";

const DEFAULT_BASE_URL = "https://api.halosis.id";
const DEFAULT_TIMEOUT = 30_000;

export interface HalosisClientOptions {
  /** Long-lived token or a provider evaluated before each authenticated request. */
  accessToken?: AccessToken;
  /** API origin or base path. Defaults to the production Halosis API. */
  baseUrl?: string;
  /** Additional headers included with every request. */
  headers?: HeadersInit;
  /** Request timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
  /** Custom fetch implementation, primarily for testing or instrumentation. */
  fetch?: typeof globalThis.fetch;
}

export class Halosis {
  readonly auth: AuthResource;
  readonly messages: MessagesResource;
  readonly templateMessages: TemplateMessagesResource;
  readonly baseUrl: string;
  readonly timeout: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly fetch: typeof globalThis.fetch;

  readonly #accessToken?: AccessToken;
  readonly #transport: HttpTransport;

  /** Whether this client was configured with an API access token. */
  get hasAccessToken(): boolean {
    return this.#accessToken !== undefined;
  }

  constructor(options: HalosisClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.timeout = validateTimeout(options.timeout ?? DEFAULT_TIMEOUT);
    this.headers = normalizeHeaders(options.headers);
    this.fetch = options.fetch ?? globalThis.fetch;

    if (typeof this.fetch !== "function") {
      throw new TypeError("A fetch implementation is required");
    }

    if (options.accessToken !== undefined) {
      this.#accessToken = normalizeAccessToken(options.accessToken);
    }

    this.#transport = new HttpTransport({
      accessToken: this.#accessToken,
      baseUrl: this.baseUrl,
      fetch: this.fetch,
      headers: this.headers,
      timeout: this.timeout,
    });
    this.auth = new AuthResource(this.#transport);
    this.messages = new MessagesResource(this.#transport);
    this.templateMessages = new TemplateMessagesResource(this.#transport);
  }

  /** Sends a low-level request to a Halosis API path. */
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T> {
    return this.#transport.request<T>(method, path, options);
  }
}

function normalizeAccessToken(value: AccessToken): AccessToken {
  if (typeof value === "function") {
    return value;
  }

  if (typeof value !== "string") {
    throw new TypeError("accessToken must be a string or a token provider");
  }

  const accessToken = value.trim();
  if (accessToken.length === 0) {
    throw new TypeError("accessToken cannot be empty");
  }

  return accessToken;
}

function normalizeBaseUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError("baseUrl must be a valid absolute URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("baseUrl must use the http or https protocol");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("baseUrl cannot include credentials, a query string, or a fragment");
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname}`;
}

function validateTimeout(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError("timeout must be a positive finite number");
  }

  return value;
}

function normalizeHeaders(value?: HeadersInit): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(new Headers(value)));
}
