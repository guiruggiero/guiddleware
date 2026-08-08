// Imports
import * as Sentry from "@sentry/node";
import {onRequest} from "firebase-functions/v2/https";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {authenticate} from "./auth.js";
import splitwiseRouter from "./routes/splitwise.js";
import settleUpRouter from "./routes/settleUp.js";
import calendarRouter from "./routes/calendar.js";
import flightAwareRouter from "./routes/flightAware.js";
import tasksRouter from "./routes/tasks.js";
import sheetsRouter from "./routes/sheets.js";

// Initialization
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  dataCollection: {
    userInfo: false,
    cookies: false,
    genAI: {inputs: false, outputs: false},
    databaseQueryData: false,
  },
  tracesSampleRate: 1.0,
  enableLogs: true,
});

// Rate limiter
const toolsRateLimit = rateLimit({
  limit: 10,
  windowMs: 10 * 60 * 1000, // 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.consumer, // Caps requests per consumer
  handler: (req, res) => res.status(429).send("Too many requests"),
});

// Express app, internally routed by path
const app = express();
app.use(helmet()); // HTTP header security
app.use(express.json());
app.use(authenticate);
app.use(toolsRateLimit);
app.use("/splitwise", splitwiseRouter);
app.use("/settleup", settleUpRouter);
app.use("/calendar", calendarRouter);
app.use("/flightaware", flightAwareRouter);
app.use("/tasks", tasksRouter);
app.use("/sheets", sheetsRouter);

// `invoker: "public"` allows unauthenticated invocations at the IAM layer;
// the actual access control is the bearer-token check in auth.js
export const guiddleware = onRequest(
  {maxInstances: 5, timeoutSeconds: 30, invoker: "public"}, app);
