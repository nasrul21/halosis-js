export { Halosis } from "./client.js";
export type { HalosisClientOptions } from "./client.js";
export { HalosisError } from "./errors.js";
export { createFormData } from "./http.js";
export type {
  AccessToken,
  AccessTokenProvider,
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
export { MessagesResource } from "./resources/messages.js";
export type {
  MessageRecipient,
  SendAudioParams,
  SendDocumentParams,
  SendImageParams,
  SendMediaParams,
  SendMessageResult,
  SendTextParams,
  SendVideoParams,
} from "./resources/messages.js";
export { TemplateMessagesResource } from "./resources/template-messages.js";
export type {
  SendTemplateParams,
  SendTemplateResult,
  TemplateButton,
  TemplateHeader,
  TemplateHeaderMedia,
  TemplateHeaderText,
} from "./resources/template-messages.js";
export { CarouselMessagesResource } from "./resources/carousel-messages.js";
export type {
  CarouselButton,
  CarouselCard,
  CarouselCardHeader,
  SendCarouselParams,
  SendCarouselResult,
} from "./resources/carousel-messages.js";

/** The version of the Halosis SDK package. */
export const VERSION = "0.1.0";
