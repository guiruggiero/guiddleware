// Imports
import {Router} from "express";
import * as Sentry from "@sentry/node";
import {getFlightAwareUrl} from "../utils/flightAware.js";

const router = Router();

// GET /flightaware/track?flightNumber=<IATA>
router.get("/track", async (req, res) => {
  const {flightNumber} = req.query;
  if (!flightNumber) {
    return res.status(400).json({error: "Missing flightNumber"});
  }

  try {
    const url = await getFlightAwareUrl(flightNumber);
    res.json({url});
  } catch (error) {
    Sentry.captureException(error, {extra: {flightNumber}});
    res.status(502).json({error: error.message});
  }
});

export default router;
