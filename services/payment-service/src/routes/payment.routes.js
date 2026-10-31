import { Router } from "express";
import { paymentController } from "../controllers/payment.controller.js";

const router = Router();

// Simulated Payment Lifecycle
router.post("/initiate", paymentController.initiate);
router.post("/verify", paymentController.verify);
router.post("/process", paymentController.process);

// Queries
router.get("/booking/:bookingRef", paymentController.getByBooking);
router.get("/:ref", paymentController.getByRef);

// Refunds
router.post("/refund", paymentController.refund);
router.post("/:ref/refund", paymentController.refund);

export default router;
