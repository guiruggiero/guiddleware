// Imports
import * as Sentry from "@sentry/node";
import {onRequest} from "firebase-functions/v2/https";
import express from "express";
import {authenticate} from "./auth.js";
import splitwiseRouter from "./routes/splitwise.js";
import calendarRouter from "./routes/calendar.js";
import flightAwareRouter from "./routes/flightAware.js";

// Initializations
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  enableLogs: true,
});

// Express app: one Cloud Function, internally routed by path
const app = express();
app.use(express.json());
app.use(authenticate);
app.use("/splitwise", splitwiseRouter);
app.use("/calendar", calendarRouter);
app.use("/flightaware", flightAwareRouter);

export const guiddleware = onRequest(
  {maxInstances: 5, timeoutSeconds: 30}, app);
