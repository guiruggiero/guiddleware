// Imports
import {Router} from "express";
import * as Sentry from "@sentry/node";
import {createExpense} from "../utils/settleUp.js";

// Initializations
const router = Router();
const HOUSEHOLD_GROUP_ID = process.env.SETTLEUP_GROUP_ID_HOUSEHOLD;
const PERSONAL_GROUP_ID = process.env.SETTLEUP_GROUP_ID_PERSONAL;
const GUI_HOUSEHOLD = process.env.SETTLEUP_MEMBER_ID_GUI_HOUSEHOLD;
const GEORGIA_HOUSEHOLD = process.env.SETTLEUP_MEMBER_ID_GEORGIA_HOUSEHOLD;
const GUI_PERSONAL = process.env.SETTLEUP_MEMBER_ID_GUI_PERSONAL;

// Enforce expense parameters before writing
function validateExpenseRequest(
  {description, amount, currency, paidBy, split}) {
  if (!description || typeof amount !== "number" || !currency) {
    return "Missing description, amount, or currency";
  }
  if (paidBy !== "gui" && paidBy !== "georgia") {
    return "paidBy must be \"gui\" or \"georgia\"";
  }

  const isEqualSplit = split === "equal";
  const isExactSplit = split !== undefined && typeof split === "object" &&
    split !== null && !Array.isArray(split);
  if (split !== undefined && !isEqualSplit && !isExactSplit) {
    return "split must be \"equal\" or {gui, georgia}";
  }

  if (isExactSplit) {
    const {gui = 0, georgia = 0} = split;
    if (typeof gui !== "number" || typeof georgia !== "number" ||
      Math.abs(gui + georgia - amount) > 0.01) {
      return "split amounts must be numbers summing to amount";
    }
  }

  return null;
}

// POST /settleup/expenses
router.post("/expenses", async (req, res) => {
  // Extract from request
  const {
    description, amount, currency, details = "", date,
    split, paidBy = "gui", category, source,
  } = req.body;

  const validationError = validateExpenseRequest(
    {description, amount, currency, paidBy, split});
  if (validationError) {
    return res.status(400).json({error: validationError});
  }
  const isEqualSplit = split === "equal";

  // "[source] description - details"
  const purpose = [source && `[${source}]`, description].filter(Boolean)
    .join(" ") + (details ? ` - ${details}` : "");

  try {
    // No split: solo expense, logged in the personal group
    if (split === undefined) {
      const result = await createExpense({
        groupId: PERSONAL_GROUP_ID, description: purpose, currency, date,
        category,
        whoPaid: [{memberId: GUI_PERSONAL, weight: "1"}],
        items: [{
          amount: amount.toFixed(2),
          forWhom: [{memberId: GUI_PERSONAL, weight: "1"}],
        }],
      });

      return res.json({expense: {id: result.name}});
    }

    // Split (equal or exact): household expense
    const payerId = paidBy === "gui" ? GUI_HOUSEHOLD : GEORGIA_HOUSEHOLD;
    const whoPaid = [{memberId: payerId, weight: "1"}];

    // Weights, not separate items
    const guiWeight = isEqualSplit ? "1" : (split.gui ?? 0).toFixed(2);
    const georgiaWeight = isEqualSplit ? "1" : (split.georgia ?? 0).toFixed(2);
    const items = [{
      amount: amount.toFixed(2),
      forWhom: [
        {memberId: GUI_HOUSEHOLD, weight: guiWeight},
        {memberId: GEORGIA_HOUSEHOLD, weight: georgiaWeight},
      ],
    }];

    const result = await createExpense({
      groupId: HOUSEHOLD_GROUP_ID, description: purpose, currency, date,
      category, whoPaid, items,
    });

    return res.json({expense: {id: result.name}});
  } catch (error) {
    Sentry.captureException(error, {
      extra: {description, amount, consumer: req.consumer},
    });

    res.status(502).json({error: error.message});

    await Sentry.flush(2000);
    return;
  }
});

export default router;
