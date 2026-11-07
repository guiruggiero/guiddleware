// Imports
import * as Sentry from "@sentry/node";
import {onRequest} from "firebase-functions/v2/https";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import {authenticate, authenticateOwner} from "./auth.js";
import onAirSignRouter from "./routes/onAirSign.js";
import splitwiseRouter from "./routes/splitwise.js";
import settleUpRouter from "./routes/settleUp.js";
import calendarRouter from "./routes/calendar.js";
import flightAwareRouter from "./routes/flightAware.js";
import tasksRouter from "./routes/tasks.js";
import sheetsRouter from "./routes/sheets.js";
import trelloRouter from "./routes/trello.js";

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

// Rate limiters, both capping requests per consumer
const makeRateLimit = (limit, windowMs) => rateLimit({
  limit,
  windowMs,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.consumer,
  handler: (req, res) => res.status(429).send("Too many requests"),
});
const toolsRateLimit = makeRateLimit(10, 10 * 60 * 1000); // 10 per 10 minutes

// Browser route: CORS locked and rate-limited
const ownerCors = cors({
  origin: ["https://guiruggiero.com", "https://www.guiruggiero.com"],
  methods: ["POST"],
  allowedHeaders: ["Authorization", "Content-Type"],
});
const ownerRateLimit = makeRateLimit(10, 60 * 1000); // 10 per minute

// Express app, internally routed by path
const app = express();
app.use(helmet()); // HTTP header security
app.use(express.json());

// Owner (browser) route: Firebase ID token, so before `authenticate`
app.use("/onairsign", ownerCors, authenticateOwner, ownerRateLimit,
  onAirSignRouter);

// Consumer (server-to-server) routes
app.use(authenticate);
app.use(toolsRateLimit);
app.use("/splitwise", splitwiseRouter);
app.use("/settleup", settleUpRouter);
app.use("/calendar", calendarRouter);
app.use("/flightaware", flightAwareRouter);
app.use("/tasks", tasksRouter);
app.use("/sheets", sheetsRouter);
app.use("/trello", trelloRouter);

// `invoker: "public"` skips IAM; access control is in auth.js
export const guiddleware = onRequest(
  {maxInstances: 5, timeoutSeconds: 30, invoker: "public"}, app);
