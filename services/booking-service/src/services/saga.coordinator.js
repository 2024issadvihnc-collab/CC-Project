import { config } from "../config/env.config.js";
import { bookingRepo } from "../database/repositories/booking.repo.js";
import { seatLockService } from "./seatLock.service.js";
import { createNotification } from "../../../../shared/notification-module/src/services/notification.service.js";
import { sendBookingConfirmation, sendPaymentReceipt } from "../../../../shared/notification-module/src/services/email.service.js";

export class PaymentFailedError extends Error {
  constructor(message = "Payment authorization failed. Booking cancelled.", details = null) {
    super(message);
    this.name = "PaymentFailedError";
    this.statusCode = 402;
    this.status = 402;
    this.details = details;
  }
}

export const sagaCoordinator = {
  /**
   * Orchestrates the distributed booking transaction with strict compensation.
   * Guarantees that payment failure CANNOT result in an incorrectly confirmed booking or ticket.
   */
  async executeBookingSaga(bookingPayload) {
    const { bookingId, eventId, seats, total, user, paymentMethod, simulateFailure } = bookingPayload;

    // STEP 1: Distributed Lock acquisition (Redis TTL / in-memory)
    const lockResult = await seatLockService.acquireLocks(eventId, seats, user?.phone || user?.email);
    if (!lockResult.success) {
      const err = new Error(lockResult.message);
      err.statusCode = 409;
      err.conflictSeats = [lockResult.conflictSeat];
      throw err;
    }

    let pendingBooking = null;

    try {
      // STEP 2: Atomic DB reservation in PENDING state with seats HELD
      pendingBooking = await bookingRepo.createPendingBookingAtomic(bookingPayload);

      // STEP 3: Mandatory Payment Processing with Idempotency Key
      let paymentRecord = null;
      const idempotencyKey = `idemp_${bookingId}_${Date.now()}`;

      try {
        const paymentRes = await fetch(`${config.paymentServiceUrl}/api/payments/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingReference: bookingId,
            amount: total,
            paymentMethod: paymentMethod || "UPI",
            idempotencyKey,
            simulateFailure: simulateFailure || paymentMethod === "FAIL",
          }),
          signal: AbortSignal.timeout(5000),
        });

        const pBody = await paymentRes.json().catch(() => ({}));

        if (!paymentRes.ok || pBody.success === false || pBody.data?.payment_status === "FAILED") {
          const failReason = pBody.error || pBody.message || "Payment authorization declined by issuing bank";
          throw new PaymentFailedError(`Payment failed: ${failReason}`, {
            paymentReference: pBody.data?.payment_reference,
            reason: failReason,
          });
        }

        paymentRecord = pBody.data || pBody;
      } catch (pErr) {
        // Payment failed or was rejected: trigger compensating transaction immediately
        console.error(`[Saga] Payment failed for booking ${bookingId}: ${pErr.message}. Executing compensation...`);
        throw pErr;
      }

      // STEP 4: Confirm Booking in DB (Only reached if payment strictly succeeded)
      const confirmedBooking = await bookingRepo.confirmBookingAtomic({
        bookingId,
        paymentReference: paymentRecord.payment_reference,
        paymentMethod,
      });

      // STEP 5: Generate Official Ticket & Scannable QR Code
      let ticketRecord = null;
      try {
        const ticketRes = await fetch(`${config.ticketServiceUrl}/api/tickets/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingReference: bookingId,
            eventId,
            eventTitle: pendingBooking.event?.title || "Event",
            seats,
            total,
            user,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (ticketRes.ok) {
          const tBody = await ticketRes.json();
          ticketRecord = tBody.data || tBody;
        }
      } catch (tErr) {
        console.warn(`[Saga] Ticket generation warning for ${bookingId}:`, tErr.message);
      }

      // STEP 6: Release temporary distributed locks (seats are permanently confirmed in DB)
      await seatLockService.releaseLocks(eventId, seats);

      // Broadcast real-time permanent seat booking to Socket.IO event room
      fetch(`${config.apiGatewayUrl}/api/realtime/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: `event:${eventId}`,
          event: "seat:booked",
          data: { eventId, seats, bookingId },
        }),
      }).catch(() => {});

      // STEP 7: Dispatch In-App Notification & Emails
      const userId = user?.id || "usr_demo_01";
      createNotification({
        userId,
        type: "BOOKING_CONFIRMED",
        title: "Booking Confirmed! 🎟️",
        message: `Your booking for "${pendingBooking.event?.title || "Event"}" (${seats.join(", ")}) is confirmed. Total: ₹${Number(total).toLocaleString()}`,
        data: { bookingId, eventId, seats, total },
      }).catch(() => {});

      // Synchronize with API Gateway notification inbox
      await fetch(`${config.apiGatewayUrl}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "BOOKING_CONFIRMED",
          title: "Booking Confirmed! 🎟️",
          message: `Your booking for "${pendingBooking.event?.title || "Event"}" (${seats.join(", ")}) is confirmed. Total: ₹${Number(total).toLocaleString()}`,
          data: { bookingId, eventId, seats, total },
        }),
      }).catch(() => {});

      if (user?.email) {
        sendBookingConfirmation({
          to: user.email,
          bookingId,
          eventTitle: pendingBooking.event?.title || "Event",
          seats,
          total,
          date: pendingBooking.event?.date || "Upcoming",
          time: pendingBooking.event?.time || "Evening",
          venue: pendingBooking.event?.venue || "Main Arena",
          city: pendingBooking.event?.city || "India",
          qrCodeData: ticketRecord?.qrCodeData,
        }).catch(() => {});

        sendPaymentReceipt({
          to: user.email,
          paymentRef: paymentRecord.payment_reference,
          txnId: paymentRecord.gateway_transaction_id,
          amount: total,
          method: paymentMethod,
          bookingId,
        }).catch(() => {});
      }

      return {
        ...pendingBooking,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        payment: paymentRecord,
        ticket: ticketRecord,
      };
    } catch (err) {
      // SAGA COMPENSATION:
      // 1. Rollback booking status to CANCELLED in DB
      if (pendingBooking) {
        console.log(`[Saga Compensation] Cancelling booking ${bookingId} and releasing held seats in DB...`);
        await bookingRepo.cancelBooking(bookingId, err.message).catch(() => {});
      }

      // 2. Release temporary seat locks
      await seatLockService.releaseLocks(eventId, seats).catch(() => {});

      // 3. Dispatch failure in-app notification
      if (user?.id) {
        createNotification({
          userId: user.id,
          type: "BOOKING_FAILED",
          title: "Booking Failed",
          message: `Payment failed for booking ${bookingId}: ${err.message}. Your held seats have been released.`,
          data: { bookingId, reason: err.message },
        }).catch(() => {});
      }

      // 4. Re-throw error so API responds with failure and NO ticket is issued
      throw err;
    }
  },
};
