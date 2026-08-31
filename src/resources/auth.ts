import type { HttpTransport } from "../http.js";

export interface LoginParams {
  email: string;
  password: string;
}

export interface LoginResult {
  message: string;
  refreshToken: string;
  tokenExpiresAt: string;
  loginAt: string;
}

export interface ExchangeRefreshTokenParams {
  refreshToken: string;
}

export interface AccessTokenResult {
  message: string;
  accessToken: string;
  tokenExpiresAt: string;
}

interface LoginWireResponse {
  message: string;
  refresh_token: string;
  token_expired_at: string;
  login_at: string;
}

interface AccessTokenWireResponse {
  message: string;
  long_lived_token: string;
  token_expired_at: string;
}

export class AuthResource {
  readonly #transport: HttpTransport;

  constructor(transport: HttpTransport) {
    this.#transport = transport;
  }

  /** Logs in with Halosis credentials and returns a refresh token valid for 24 hours. */
  async login(params: LoginParams): Promise<LoginResult> {
    const email = requireNonEmpty("email", params.email);
    const password = requireNonEmpty("password", params.password);
    const response = await this.#transport.request<LoginWireResponse>("POST", "/v1/login", {
      authenticated: false,
      body: { email, password },
    });

    return {
      message: requireResponseString(response, "message"),
      refreshToken: requireResponseString(response, "refresh_token"),
      tokenExpiresAt: requireResponseString(response, "token_expired_at"),
      loginAt: requireResponseString(response, "login_at"),
    };
  }

  /** Exchanges a refresh token for a long-lived access token valid for 60 days. */
  async exchangeRefreshToken(params: ExchangeRefreshTokenParams): Promise<AccessTokenResult> {
    const refreshToken = requireNonEmpty("refreshToken", params.refreshToken);
    const response = await this.#transport.request<AccessTokenWireResponse>(
      "POST",
      "/v1/access-token",
      {
        authenticated: false,
        body: { refresh_token: refreshToken },
      },
    );

    return {
      message: requireResponseString(response, "message"),
      accessToken: requireResponseString(response, "long_lived_token"),
      tokenExpiresAt: requireResponseString(response, "token_expired_at"),
    };
  }
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
