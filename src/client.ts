const DEFAULT_BASE_URL = "https://api.halosis.id";
const DEFAULT_TIMEOUT = 30_000;

export interface HalosisClientOptions {
  /** Long-lived Halosis access token used to authenticate API requests. */
  accessToken?: string;
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
  readonly baseUrl: string;
  readonly timeout: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly fetch: typeof globalThis.fetch;

  readonly #accessToken?: string;
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
      const accessToken = options.accessToken.trim();

      if (accessToken.length === 0) {
        throw new TypeError("accessToken cannot be empty");
      }

      this.#accessToken = accessToken;
    }

    this.#transport = new HttpTransport({
      accessToken: this.#accessToken,
      baseUrl: this.baseUrl,
      fetch: this.fetch,
      headers: this.headers,
      timeout: this.timeout,
    });
  }

  /** Sends a low-level request to a Halosis API path. */
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T> {
    return this.#transport.request<T>(method, path, options);
  }
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
import { HttpTransport } from "./http.js";
import type { HttpMethod, RequestOptions } from "./http.js";
