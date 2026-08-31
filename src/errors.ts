import type { HttpMethod } from "./http.js";

interface HalosisErrorOptions {
  body: unknown;
  method: HttpMethod;
  response: Response;
  url: string;
}

/** An unsuccessful response returned by the Halosis API. */
export class HalosisError extends Error {
  override readonly name = "HalosisError";
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;
  readonly body: unknown;
  readonly headers: Headers;
  readonly method: HttpMethod;
  readonly url: string;
  readonly requestId: string | undefined;
  readonly retryAfter: string | undefined;
  readonly isRetryable: boolean;
  readonly response: Response;

  constructor(options: HalosisErrorOptions) {
    super(resolveErrorMessage(options.response.status, options.body), { cause: options.body });

    const body = asRecord(options.body);
    const rawCode = body?.code;

    this.status = options.response.status;
    this.code =
      typeof rawCode === "string" || typeof rawCode === "number" ? String(rawCode) : undefined;
    this.details = resolveErrorDetails(body);
    this.body = options.body;
    this.headers = new Headers(options.response.headers);
    this.method = options.method;
    this.url = options.url;
    this.requestId =
      this.headers.get("x-request-id") ?? this.headers.get("x-correlation-id") ?? undefined;
    this.retryAfter = this.headers.get("retry-after") ?? undefined;
    this.isRetryable = this.status === 429 || this.status >= 500;
    this.response = options.response;
  }
}

function resolveErrorMessage(status: number, value: unknown): string {
  const body = asRecord(value);
  if (typeof body?.message === "string" && body.message.trim().length > 0) {
    return body.message;
  }

  switch (status) {
    case 401:
      return "Halosis API authentication failed";
    case 403:
      return "Halosis API permission denied";
    case 404:
      return "Halosis API resource not found";
    case 422:
      return "Halosis API validation failed";
    case 429:
      return "Halosis API rate limit exceeded";
    default:
      return status >= 500
        ? "Halosis API server error"
        : `Halosis API request failed with status ${status}`;
  }
}

function resolveErrorDetails(body: Record<string, unknown> | undefined): unknown {
  if (body === undefined) {
    return undefined;
  }

  if (body.errors !== undefined) {
    return body.errors;
  }

  return typeof body.message === "string" ? undefined : body.message;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
