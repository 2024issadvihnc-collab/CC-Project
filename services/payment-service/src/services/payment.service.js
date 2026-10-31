import { paymentRepo } from "../database/repositories/payment.repo.js";

export const paymentService = {
  /**
   * Step 1: Initiate Payment Session in Payment Service
   */
  async initiatePayment({ bookingReference, amount, paymentMethod = "UPI", idempotencyKey, currency = "INR" }) {
    if (!bookingReference) throw new Error("Booking reference is required");
    if (!amount || amount <= 0) throw new Error("Valid payment amount is required");

    // Check Idempotency Key
    if (idempotencyKey) {
      const existing = await paymentRepo.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          ...existing,
          isDuplicate: true,
        };
      }
    }

    const gatewayTransactionId = "TXN_SIM_" + Math.random().toString(36).slice(2, 10).toUpperCase();
    const paymentReference = "PAY_" + bookingReference + "_" + Date.now().toString(36).toUpperCase();

    const paymentRecord = await paymentRepo.recordPayment({
      paymentReference,
      bookingReference,
      amount,
      currency,
      paymentMethod,
      paymentStatus: "INITIATED",
      idempotencyKey,
      gatewayTransactionId,
      metadata: {
        gateway: "ShowTime Pay Simulator v2.0",
        initiatedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      paymentReference,
      gatewayTransactionId,
      bookingReference,
      amount,
      currency,
      status: "INITIATED",
      paymentMethod,
      supportedMethods: ["UPI", "CARD", "NETBANKING"],
    };
  },

  /**
   * Step 2: Authorize or Reject Simulated Payment
   */
  async verifyPayment({ paymentReference, action = "AUTHORIZE", failureReason = "Card declined by issuing bank" }) {
    const payment = await paymentRepo.getPaymentByReference(paymentReference);
    if (!payment) throw new Error(`Payment reference ${paymentReference} not found`);

    if (payment.payment_status === "COMPLETED") {
      return {
        success: true,
        status: "COMPLETED",
        paymentReference: payment.payment_reference,
        gatewayTransactionId: payment.gateway_transaction_id,
        amount: payment.amount,
        isAlreadyCompleted: true,
      };
    }

    if (action === "DECLINE" || action === "FAIL") {
      const updated = await paymentRepo.updatePaymentStatus({
        paymentReference,
        paymentStatus: "FAILED",
        metadata: {
          failureReason,
          failedAt: new Date().toISOString(),
        },
      });

      const err = new Error(failureReason);
      err.statusCode = 402;
      err.paymentStatus = "FAILED";
      err.paymentReference = paymentReference;
      err.payment = updated;
      throw err;
    }

    if (action === "TIMEOUT") {
      const timeoutReason = "Bank network timeout during authorization. Please retry.";
      await paymentRepo.updatePaymentStatus({
        paymentReference,
        paymentStatus: "FAILED",
        metadata: {
          failureReason: timeoutReason,
          failedAt: new Date().toISOString(),
        },
      });

      const err = new Error(timeoutReason);
      err.statusCode = 504;
      err.paymentStatus = "FAILED";
      err.paymentReference = paymentReference;
      throw err;
    }

    // Success / Authorize
    const updated = await paymentRepo.updatePaymentStatus({
      paymentReference,
      paymentStatus: "COMPLETED",
      metadata: {
        settledAt: new Date().toISOString(),
        authCode: "AUTH_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      },
    });

    return {
      success: true,
      status: "COMPLETED",
      paymentReference: updated.payment_reference,
      gatewayTransactionId: updated.gateway_transaction_id,
      amount: updated.amount,
      currency: updated.currency,
      paymentMethod: updated.payment_method,
      settledAt: new Date().toISOString(),
    };
  },

  /**
   * Combined Single-Shot Process Payment (For Booking Saga Coordinator)
   */
  async processPayment({ bookingReference, amount, paymentMethod = "UPI", idempotencyKey, simulateFailure }) {
    if (!bookingReference) throw new Error("Booking reference is required");
    if (!amount || amount <= 0) throw new Error("Valid payment amount is required");

    // Check Idempotency Key
    if (idempotencyKey) {
      const existing = await paymentRepo.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          ...existing,
          isDuplicate: true,
        };
      }
    }

    // Simulated payment failure for testing Saga compensation
    if (paymentMethod === "FAIL" || simulateFailure === true) {
      const failedReference = "PAY_FAILED_" + bookingReference + "_" + Date.now().toString(36).toUpperCase();
      await paymentRepo.recordPayment({
        paymentReference: failedReference,
        bookingReference,
        amount,
        currency: "INR",
        paymentMethod,
        paymentStatus: "FAILED",
        idempotencyKey,
        gatewayTransactionId: null,
        metadata: { gateway: "ShowTime Pay Simulator", failureReason: "Card declined by issuing bank" },
      });

      const err = new Error("Payment authorization declined by issuing bank");
      err.statusCode = 402;
      err.paymentStatus = "FAILED";
      err.paymentReference = failedReference;
      throw err;
    }

    // Mock Gateway authorization
    const gatewayTransactionId = "TXN_SIM_" + Math.random().toString(36).slice(2, 10).toUpperCase();
    const paymentReference = "PAY_" + bookingReference + "_" + Date.now().toString(36).toUpperCase();

    const paymentRecord = await paymentRepo.recordPayment({
      paymentReference,
      bookingReference,
      amount,
      currency: "INR",
      paymentMethod,
      paymentStatus: "COMPLETED",
      idempotencyKey,
      gatewayTransactionId,
      metadata: { gateway: "ShowTime Pay Simulator", settledAt: new Date().toISOString() },
    });

    console.log(`[Payment-Service] Processed payment ${paymentReference} for ${bookingReference} (Amount: INR ${amount})`);
    return paymentRecord;
  },

  async getPayment(paymentReference) {
    return await paymentRepo.getPaymentByReference(paymentReference);
  },

  async getPaymentByBooking(bookingReference) {
    return await paymentRepo.getPaymentByBooking(bookingReference);
  },

  async refund(paymentReference, reason) {
    let payment = await paymentRepo.getPaymentByReference(paymentReference);
    if (!payment) {
      // Try by booking reference
      payment = await paymentRepo.getPaymentByBooking(paymentReference);
    }
    if (!payment) throw new Error(`Payment reference ${paymentReference} not found`);
    return await paymentRepo.processRefund(payment.payment_reference, payment.amount, reason);
  },
};
