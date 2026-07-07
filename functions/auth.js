// Import
import * as Sentry from "@sentry/node";

const SECRET_PREFIX = "GUIDDLEWARE_SECRET_";

// Per-consumer bearer tokens, one env var per consumer
// (e.g. GUIDDLEWARE_SECRET_GUIMAIL)
const consumerBySecret = new Map();
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith(SECRET_PREFIX) && value) {
    consumerBySecret.set(value, key.slice(SECRET_PREFIX.length).toLowerCase());
  }
}

// Validates the bearer token and attaches the resolved consumer to the request
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const signature = authHeader?.split(" ")[1];
  const consumer = signature && consumerBySecret.get(signature);
  if (!authHeader || !consumer) {
    Sentry.logger.warn("Guiddleware: unauthorized request", {
      authHeaderPresent: !!authHeader,
      reason: authHeader ? "Invalid signature" : "No signature",
    });

    return res.status(401).send("Unauthorized");
  }

  Sentry.setTag("consumer", consumer);
  req.consumer = consumer;
  next();
};
