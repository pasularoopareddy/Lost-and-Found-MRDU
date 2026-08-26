import { Router } from "express";
import { forgotPassword, login, register, resetPassword, verifyRegistration } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/verify-registration", verifyRegistration);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
