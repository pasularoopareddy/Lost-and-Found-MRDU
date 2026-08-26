import { Router } from "express";
import { createReport, getMyReports, getPossibleMatches, getReport, listReports, markRecovered } from "../controllers/report.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requestChat } from "../controllers/chat.controller.js";

const router = Router();

router.get("/", listReports);
router.get("/mine", requireAuth, getMyReports);
router.get("/matches", requireAuth, getPossibleMatches);
router.get("/:id", getReport);
router.post("/", requireAuth, createReport);
router.post("/:id/chat-requests", requireAuth, requestChat);
router.patch("/:id/recovered", requireAuth, markRecovered);

export default router;
