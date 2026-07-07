// Imports
import {Router} from "express";
import * as Sentry from "@sentry/node";
import {getCalendarClient} from "../utils/googleCalendar.js";

const router = Router();

// Calendar IDs (set in Firebase env vars)
const CALENDARS = {
  default: process.env.GOOGLE_CAL_DEFAULT_ID,
  shared: process.env.GOOGLE_CAL_SHARED_ID,
};

// POST /calendar/events
router.post("/events", async (req, res) => {
  const {
    summary, start, end, timeZone, location, description,
    calendar: calendarKey = "default", reminders, isSpecialProject,
  } = req.body;

  if (!summary || !start || !end) {
    return res.status(400).json({error: "Missing summary, start, or end"});
  }
  const calendarId = CALENDARS[calendarKey];
  if (!calendarId) {
    return res.status(400).json({error: `Unknown calendar: ${calendarKey}`});
  }

  const isAllDay = !start.includes("T");
  const eventResource = {
    summary,
    description: description ?? "",
    location,
    // All-day events show as free; timed events show as busy
    transparency: isAllDay ? "transparent" : "opaque",
  };

  if (isAllDay) {
    eventResource.start = {date: start};
    eventResource.end = {date: end};
  } else {
    eventResource.start = {dateTime: start, timeZone};
    eventResource.end = {dateTime: end, timeZone};
  }

  if (reminders?.length) {
    eventResource.reminders = {
      useDefault: false,
      overrides: reminders.slice(0, 5).map((reminder) => ({
        method: reminder.method,
        minutes: Math.min(Math.max(Math.round(reminder.minutes), 0), 40320),
      })),
    };
  }

  if (isSpecialProject) eventResource.colorId = "10"; // Basil

  try {
    const calendar = await getCalendarClient();
    const result = await calendar.events.insert({
      calendarId, resource: eventResource,
    });
    Sentry.logger.info("Guiddleware: Google Calendar event created", {
      calendarId, eventId: result.data.id, consumer: req.consumer,
    });

    res.json({id: result.data.id, link: result.data.htmlLink});
  } catch (error) {
    Sentry.captureException(error, {extra: {summary, calendarKey}});
    res.status(502).json({error: error.message});
  }
});

export default router;
