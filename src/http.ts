export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | readonly (string | number | boolean | Date | null | undefined)[];

export interface RequestOptions {
  /** Set to false for unauthenticated endpoints such as login. */
  authenticated?: boolean;
  /** JSON-compatible request body. */
  body?: unknown;
  /** Headers applied to this request. */
  headers?: HeadersInit;
  /** Query parameters. Arrays are encoded as repeated keys. */
  query?: Readonly<Record<string, QueryValue>>;
  /** Signal used to cancel the request. */
  signal?: AbortSignal;
}

interface HttpTransportOptions {
  accessToken: string | undefined;
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  headers: Readonly<Record<string, string>>;
  timeout: number;
}

export class HttpTransport {
  readonly #accessToken: string | undefined;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #headers: Readonly<Record<string, string>>;
  readonly #timeout: number;

  constructor(options: HttpTransportOptions) {
    this.#accessToken = options.accessToken;
    this.#baseUrl = options.baseUrl;
    this.#fetch = options.fetch;
    this.#headers = options.headers;
    this.#timeout = options.timeout;
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const url = buildUrl(this.#baseUrl, path, options.query);
    const headers = new Headers(this.#headers);

    for (const [name, value] of new Headers(options.headers)) {
      headers.set(name, value);
    }

    if (options.authenticated !== false && this.#accessToken !== undefined) {
      headers.set("authorization", `Bearer ${this.#accessToken}`);
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      if (method === "GET") {
        throw new TypeError("GET requests cannot include a body");
      }

      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }

    const { cleanup, signal } = createRequestSignal(this.#timeout, options.signal);

    try {
      const response = await this.#fetch(url, {
        method,
        headers,
        signal,
        ...(body === undefined ? {} : { body }),
      });
      const responseBody = await parseResponseBody(response);

      if (!response.ok) {
        throw new Error(`Halosis API request failed with status ${response.status}`, {
          cause: responseBody,
        });
      }

      return responseBody as T;
    } finally {
      cleanup();
    }
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Readonly<Record<string, QueryValue>>,
): string {
  if (/^https?:\/\//i.test(path)) {
    throw new TypeError("path must be relative to baseUrl");
  }

  const url = new URL(`${baseUrl}/${path.replace(/^\/+/, "")}`);

  for (const [name, rawValue] of Object.entries(query ?? {})) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(name, value instanceof Date ? value.toISOString() : String(value));
      }
    }
  }

  return url.toString();
}

function createRequestSignal(
  timeout: number,
  externalSignal?: AbortSignal,
): { cleanup: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  const abortFromExternalSignal = (): void => controller.abort(externalSignal?.reason);
  const timeoutId = setTimeout(() => controller.abort(new Error("Request timed out")), timeout);

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    },
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase();
  if (contentType?.includes("application/json") || contentType?.includes("+json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}
