// Imports
import {Router} from "express";
import * as Sentry from "@sentry/node";
import {getTasksClient} from "../utils/googleTasks.js";

const router = Router();

// Google Tasks silently discards time-of-day, so `due` is date-only
const toDueTimestamp = (due) =>
  due ? new Date(`${due}T00:00:00.000Z`).toISOString() : undefined;

// POST /tasks
router.post("/", async (req, res) => {
  const {title, notes, due, taskListId} = req.body;
  if (!title) {
    return res.status(400).json({error: "Missing title"});
  }

  try {
    const tasks = await getTasksClient();
    const result = await tasks.tasks.insert({
      tasklist: taskListId ?? process.env.GOOGLE_TASKS_LIST_ID,
      resource: {title, notes, due: toDueTimestamp(due)},
    });

    Sentry.logger.info("Guiddleware: task created", {
      taskId: result.data.id, consumer: req.consumer,
    });

    res.json({id: result.data.id, title: result.data.title});
  } catch (error) {
    Sentry.captureException(error, {extra: {title}});
    res.status(502).json({error: error.message});
  }
});

// GET /tasks
router.get("/", async (req, res) => {
  const {taskListId, showCompleted} = req.query;

  try {
    const tasks = await getTasksClient();
    const result = await tasks.tasks.list({
      tasklist: taskListId ?? process.env.GOOGLE_TASKS_LIST_ID,
      showCompleted: showCompleted === "true",
    });

    res.json({
      tasks: (result.data.items ?? []).map(
        ({id, title, notes, due, status}) => ({id, title, notes, due, status}),
      ),
    });
  } catch (error) {
    Sentry.captureException(error);
    res.status(502).json({error: error.message});
  }
});

// PATCH /tasks/:id
router.patch("/:id", async (req, res) => {
  const {id} = req.params;
  const {status = "completed", taskListId} = req.body;

  try {
    const tasks = await getTasksClient();
    const result = await tasks.tasks.patch({
      tasklist: taskListId ?? process.env.GOOGLE_TASKS_LIST_ID,
      task: id,
      resource: {status},
    });

    Sentry.logger.info("Guiddleware: task updated", {
      taskId: id, status: result.data.status, consumer: req.consumer,
    });

    res.json({id: result.data.id, status: result.data.status});
  } catch (error) {
    Sentry.captureException(error, {extra: {id}});
    res.status(502).json({error: error.message});
  }
});

export default router;
