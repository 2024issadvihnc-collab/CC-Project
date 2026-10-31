import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimiter.middleware.js";
import { optionalAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/auth/register", authLimiter, authController.register);
router.post("/auth/login", authLimiter, authController.login);
router.post("/auth/reset-password", authLimiter, authController.resetPassword);
router.post("/auth/send-otp", authLimiter, authController.sendOtp);
router.post("/auth/verify-otp", authLimiter, authController.verifyOtp);

router.put("/auth/profile", optionalAuth, authController.updateProfile);
router.delete("/auth/account", optionalAuth, authController.deleteAccount);

export default router;

