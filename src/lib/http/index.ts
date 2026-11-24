import "server-only";

export {
  SafeFetchError,
  isPublicIpAddress,
  parseRetryAfter,
  safeFetch,
  sanitizeRequestHeaders,
} from "./safe-fetch";

export type {
  DnsResolver,
  FetchImplementation,
  ResolvedAddress,
  SafeFetchErrorCode,
  SafeFetchOptions,
  SafeFetchResponse,
} from "./safe-fetch";

