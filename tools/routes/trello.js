// Imports
import {Router} from "express";
import * as Sentry from "@sentry/node";
import {createCard, updateCard, searchCards} from "../utils/trello.js";

const router = Router();

// POST /trello/cards
router.post("/cards", async (req, res) => {
  const {list = "inbox", name, description} = req.body;
  if (!name) {
    return res.status(400).json({error: "Missing name"});
  }

  try {
    const card = await createCard(list, name, description);

    Sentry.logger.info("Trello card created", {
      cardId: card.id, list, consumer: req.consumer,
    });

    res.json({id: card.id, url: card.shortUrl});
  } catch (error) {
    Sentry.captureException(error, {extra: {name, list}});

    res.status(502).json({error: error.message});

    await Sentry.flush(2000);
  }
});

// PATCH /trello/cards/:id
router.patch("/cards/:id", async (req, res) => {
  const {id} = req.params;
  const {name, note, list, direction} = req.body;

  if (list !== undefined && direction !== undefined) {
    return res.status(400).json(
      {error: "Provide either list or direction, not both"});
  }
  if ([name, note, list, direction].every((value) => value === undefined)) {
    return res.status(400).json(
      {error: "Missing name, note, list, or direction"});
  }

  try {
    const card = await updateCard(id, {name, note, list, direction});

    Sentry.logger.info("Trello card updated", {
      cardId: id, consumer: req.consumer,
    });

    res.json({
      id: card.id, name: card.name, description: card.desc,
      url: card.shortUrl,
    });
  } catch (error) {
    Sentry.captureException(error, {extra: {id}});

    res.status(502).json({error: error.message});

    await Sentry.flush(2000);
  }
});

// GET /trello/cards/search
router.get("/cards/search", async (req, res) => {
  const {q, limit} = req.query;
  if (!q) {
    return res.status(400).json({error: "Missing q"});
  }

  try {
    const cards = await searchCards(q, limit ? Number(limit) : undefined);

    res.json({cards});
  } catch (error) {
    Sentry.captureException(error, {extra: {q}});

    res.status(502).json({error: error.message});

    await Sentry.flush(2000);
  }
});

export default router;
