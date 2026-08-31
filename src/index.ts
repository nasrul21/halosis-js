export { Halosis } from "./client.js";
export type { HalosisClientOptions } from "./client.js";
export { HalosisError } from "./errors.js";
export { createFormData } from "./http.js";
export type {
  HttpMethod,
  MultipartFields,
  MultipartFile,
  MultipartScalar,
  MultipartValue,
  QueryValue,
  RequestOptions,
} from "./http.js";
export { AuthResource } from "./resources/auth.js";
export type {
  AccessTokenResult,
  ExchangeRefreshTokenParams,
  LoginParams,
  LoginResult,
} from "./resources/auth.js";

/** The version of the Halosis SDK package. */
export const VERSION = "0.1.0";
