// Imports
import {Router} from "express";
import * as Sentry from "@sentry/node";
import {getSheetsClient} from "../utils/googleSheets.js";

const router = Router();

// No hardcoded spreadsheet (unlike Splitwise/Calendar) — caller picks one
router.post("/values", async (req, res) => {
  const {spreadsheetId, data} = req.body;
  if (!spreadsheetId || !Array.isArray(data) || data.length === 0) {
    return res.status(400)
      .json({error: "Missing spreadsheetId or data"});
  }

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {valueInputOption: "USER_ENTERED", data},
    });

    Sentry.logger.info("Guiddleware: Google Sheet updated", {
      spreadsheetId, ranges: data.map((d) => d.range), consumer: req.consumer,
    });

    res.json({success: true});
  } catch (error) {
    Sentry.captureException(error, {extra: {spreadsheetId}});
    res.status(502).json({error: error.message});
  }
});

export default router;
