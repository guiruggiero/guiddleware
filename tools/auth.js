// Imports
import * as Sentry from "@sentry/node";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";

// Initialization
const SECRET_PREFIX = "GUIDDLEWARE_SECRET_";
// Same UID as in the website's firestore.rules, not a secret
const OWNER_UID = "JWOy6NR2yNTrZ4vdtdt5be1HO8D3";
initializeApp(); // Credentials come from the Cloud Functions runtime

// Per-consumer bearer tokens, one env var per consumer
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

// Browser routes: validates a Firebase ID token, requiring the owner's UID
export const authenticateOwner = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  if (!token) {
    Sentry.logger.warn("Guiddleware: owner request without token", {
      path: req.path,
    });

    return res.status(401).send("Unauthorized");
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);

    // Anyone can create a Firebase account, so a valid token isn't enough
    if (decoded.uid !== OWNER_UID) {
      Sentry.logger.warn("Guiddleware: owner request from another user", {
        path: req.path, uid: decoded.uid,
      });

      return res.status(403).send("Forbidden");
    }

    Sentry.setTag("consumer", "owner");
    req.consumer = "owner";
    next();
  } catch (error) {
    // Expired or malformed tokens are routine, so logged instead of captured
    Sentry.logger.warn("Guiddleware: invalid owner token", {
      path: req.path, code: error.code, reason: error.message,
    });

    res.status(401).send("Unauthorized");
  }
};
