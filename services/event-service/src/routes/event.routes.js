import { Router } from "express";
import { eventController } from "../controllers/event.controller.js";

const router = Router();

router.get("/", eventController.getAll);
router.post("/", eventController.create);
router.get("/:id/seats", eventController.getSeats);
router.get("/:id", eventController.getById);
router.delete("/:id", eventController.delete);

export default router;

