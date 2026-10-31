import { Router } from "express";
import { eventController } from "../controllers/event.controller.js";

const router = Router();

router.get("/categories", eventController.getCategories);
router.get("/cities", eventController.getCities);
router.get("/events", eventController.getAllEvents);
router.get("/events/:id", eventController.getEventById);
router.get("/events/:id/seats", eventController.getEventSeats);

export default router;

