import { Router } from "express";
import { healthController } from "../controllers/health.controller.js";

const router = Router();

router.get("/health", healthController.getLiveness);
router.get("/health/ready", healthController.getReadiness);

export default router;

