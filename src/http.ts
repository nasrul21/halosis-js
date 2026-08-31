export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AccessTokenProvider = () => string | undefined | Promise<string | undefined>;
export type AccessToken = string | AccessTokenProvider;

export type QueryValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | readonly (string | number | boolean | Date | null | undefined)[];

export interface MultipartFile {
  /** File contents. Use `openAsBlob` from `node:fs` for files on disk. */
  data: Blob;
  /** Filename sent in the multipart content disposition. */
  filename: string;
}

export type MultipartScalar =
  string | number | boolean | Date | Blob | MultipartFile | null | undefined;
export type MultipartValue = MultipartScalar | readonly MultipartScalar[];
export type MultipartFields = Readonly<Record<string, MultipartValue>>;

export interface RequestOptions {
  /** Set to false for unauthenticated endpoints such as login. */
  authenticated?: boolean;
  /** JSON-compatible request body. */
  body?: unknown;
  /** Headers applied to this request. */
  headers?: HeadersInit;
  /** Multipart form data or fields. Cannot be combined with `body`. */
  form?: FormData | MultipartFields;
  /** Query parameters. Arrays are encoded as repeated keys. */
  query?: Readonly<Record<string, QueryValue>>;
  /** Signal used to cancel the request. */
  signal?: AbortSignal;
}

interface HttpTransportOptions {
  accessToken: AccessToken | undefined;
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  headers: Readonly<Record<string, string>>;
  timeout: number;
}

export class HttpTransport {
  readonly #accessToken: AccessToken | undefined;
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

    if (options.authenticated !== false) {
      const accessToken = await resolveAccessToken(this.#accessToken);
      if (accessToken !== undefined) {
        headers.set("authorization", `Bearer ${accessToken}`);
      }
    }

    if (options.body !== undefined && options.form !== undefined) {
      throw new TypeError("body and form cannot be used together");
    }

    let body: BodyInit | undefined;
    if (options.body !== undefined || options.form !== undefined) {
      if (method === "GET") {
        throw new TypeError("GET requests cannot include a body");
      }
    }

    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    } else if (options.form !== undefined) {
      // Native fetch must generate the multipart boundary in this header.
      headers.delete("content-type");
      body = options.form instanceof FormData ? options.form : createFormData(options.form);
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
        throw new HalosisError({
          body: responseBody,
          method,
          response,
          url,
        });
      }

      return responseBody as T;
    } finally {
      cleanup();
    }
  }
}

async function resolveAccessToken(value: AccessToken | undefined): Promise<string | undefined> {
  const token = typeof value === "function" ? await value() : value;

  if (token === undefined) {
    return undefined;
  }

  if (typeof token !== "string") {
    throw new TypeError("accessToken provider must return a string or undefined");
  }

  const normalizedToken = token.trim();
  if (normalizedToken.length === 0) {
    throw new TypeError("accessToken provider returned an empty token");
  }

  return normalizedToken;
}

export function createFormData(fields: MultipartFields): FormData {
  const form = new FormData();

  for (const [name, rawValue] of Object.entries(fields)) {
    const values: readonly MultipartScalar[] = Array.isArray(rawValue)
      ? (rawValue as readonly MultipartScalar[])
      : [rawValue as MultipartScalar];

    for (const value of values) {
      if (value === undefined || value === null) {
        continue;
      }

      if (isMultipartFile(value)) {
        if (value.filename.length === 0) {
          throw new TypeError(`Multipart filename for ${name} cannot be empty`);
        }

        form.append(name, value.data, value.filename);
      } else if (value instanceof Blob) {
        form.append(name, value);
      } else {
        form.append(name, value instanceof Date ? value.toISOString() : String(value));
      }
    }
  }

  return form;
}

function isMultipartFile(value: MultipartScalar): value is MultipartFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    value.data instanceof Blob &&
    "filename" in value &&
    typeof value.filename === "string"
  );
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
import { HalosisError } from "./errors.js";
