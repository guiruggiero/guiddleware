// Imports
import {Router} from "express";
import * as Sentry from "@sentry/node";
import {setSignFeed} from "../utils/adafruit.js";

// Initialization
const router = Router();
const STATES = ["off", "yellow", "red"];
const MAX_HOLD_MINUTES = 480; // 8 hours

// POST /onairsign
router.post("/", async (req, res) => {
  const {state, minutes} = req.body;
  if (!STATES.includes(state)) {
    return res.status(400).json({error: "Invalid state"});
  }
  const validMinutes = Number.isInteger(minutes) &&
    minutes >= 1 && minutes <= MAX_HOLD_MINUTES;
  if (minutes !== undefined && !validMinutes) {
    return res.status(400).json({error: "Invalid minutes"});
  }

  // The feed value is built here, never forwarded from the client
  const value = state === "off" || minutes === undefined ?
    state : `${state}:${minutes}`;

  try {
    await setSignFeed(value);

    Sentry.logger.info("On Air sign set", {value, consumer: req.consumer});

    res.json({value});
  } catch (error) {
    Sentry.captureException(error, {extra: {value}});

    res.status(502).json({error: error.message});

    await Sentry.flush(2000);
  }
});

export default router;
