export const __prod__ = process.env.NODE_ENV == "production";

export const COOKIE_NAME = "sid";

export const DOMAIN_NAME = __prod__ ? "https://vertais.fi" : "http://localhost:3000";

export const PASSWORD_RESET_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24;

export const MAX_LOG_MESSAGE_LENGTH = 100;

export const UNAUTHORIZED_ACCESS_ERROR_MESSAGE = "Sinulla ei oikeuksia tähän toimintoon. Oletko kirjautunut sisään?";
