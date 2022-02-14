// env
export const __PROD__ = process.env.NODE_ENV === "production";
export const __DEV__ = (process.env.NODE_ENV ?? "development") === "development";

// Session
export const COOKIE_NAME = "sid";
export const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 7 * 24; // 1 week
export const PASSWORD_RESET_TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 1 day

// Logging
export const MAX_LOG_MESSAGE_LENGTH = 200;

// Error messages
export const UNAUTHORIZED_ACCESS_ERROR_MESSAGE = "Sinulla ei oikeuksia tähän toimintoon. Oletko kirjautunut sisään?";
export const UNKNOWN_ERROR_MESSAGE = "Jokin meni pieleen, pahoittelumme";

// User validation
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 100;
export const MIN_PASSWORD_LENGTH = 5;
export const MAX_PASSWORD_LENGTH = 100;
export const MAX_FIRSTNAME_OR_LASTNAME_LENGTH = 50;

// Misc
export const COURSE_CODE_LENGTH = 4;
export const PASSWORD_HASH_SALT_ROUNDS = 10;
export const FILE_UPLOAD_MAX_SIZE = 100 * 1024 * 1024; // 100 mb
export const DOMAIN_NAME = process.env.DOMAIN_NAME ?? __PROD__ ? "https://vertais.fi" : "http://localhost:3000";

// sql
export const COMMENT_CHECK_CONSTRAINT_NAME = "ck_comment_at_least_one_foreign_key";
export enum PostgreSQLErrorCodes {
  UNIQUE_VIOLATION = "23505",
  CHECK_VIOLATION = "23514",
  SERILALIZATION_FAILURE = "40001",
  FOREIGN_KEY_VIOLATION = "23503",
}
