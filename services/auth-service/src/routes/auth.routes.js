import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/reset-password", authController.resetPassword);
router.post("/change-password", authenticate, authController.changePassword);
router.put("/change-password", authenticate, authController.changePassword);
router.put("/profile", authenticate, authController.updateProfile);
router.delete("/account", authenticate, authController.deleteAccount);

export default router;

