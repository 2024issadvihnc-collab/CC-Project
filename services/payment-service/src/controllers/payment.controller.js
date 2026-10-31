import { paymentService } from "../services/payment.service.js";
import { sendSuccess, sendError } from "../../../../shared/common-utils/response.js";

export const paymentController = {
  async initiate(req, res) {
    try {
      const { bookingReference, amount, paymentMethod, idempotencyKey, currency } = req.body;
      const key = idempotencyKey || req.headers["x-idempotency-key"];
      const result = await paymentService.initiatePayment({
        bookingReference,
        amount,
        paymentMethod,
        idempotencyKey: key,
        currency,
      });
      return sendSuccess(res, result, "Payment session initiated", 201);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async verify(req, res) {
    try {
      const { paymentReference, action, failureReason } = req.body;
      const result = await paymentService.verifyPayment({
        paymentReference,
        action,
        failureReason,
      });
      return sendSuccess(res, result, "Payment verified successfully");
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({
        success: false,
        error: err.message,
        paymentStatus: err.paymentStatus || "FAILED",
        paymentReference: err.paymentReference,
      });
    }
  },

  async process(req, res) {
    try {
      const { bookingReference, amount, paymentMethod, idempotencyKey, simulateFailure } = req.body;
      const key = idempotencyKey || req.headers["x-idempotency-key"];
      const result = await paymentService.processPayment({
        bookingReference,
        amount,
        paymentMethod,
        idempotencyKey: key,
        simulateFailure,
      });
      return sendSuccess(res, result, "Payment processed successfully", 201);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async getByRef(req, res) {
    try {
      const result = await paymentService.getPayment(req.params.ref);
      if (!result) return res.status(404).json({ error: "Payment not found" });
      return sendSuccess(res, result);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async getByBooking(req, res) {
    try {
      const result = await paymentService.getPaymentByBooking(req.params.bookingRef);
      if (!result) return res.status(404).json({ error: "Payment not found for booking" });
      return sendSuccess(res, result);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async refund(req, res) {
    try {
      const ref = req.params.ref || req.body.paymentReference || req.body.bookingReference;
      if (!ref) return res.status(400).json({ error: "Payment reference or booking reference is required" });
      const result = await paymentService.refund(ref, req.body.reason);
      return sendSuccess(res, result, "Refund processed successfully");
    } catch (err) {
      return sendError(res, err, 400);
    }
  },
};
