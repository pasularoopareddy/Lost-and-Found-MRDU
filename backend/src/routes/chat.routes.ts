import { Router } from "express";
import { getMessages, listChatRequests, respondToChatRequest, sendMessage } from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);
router.get("/requests", listChatRequests);
router.patch("/requests/:id", respondToChatRequest);
router.get("/:id/messages", getMessages);
router.post("/:id/messages", sendMessage);
export default router;
