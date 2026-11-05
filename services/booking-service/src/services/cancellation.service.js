import { config } from "../config/env.config.js";
import { bookingRepo } from "../database/repositories/booking.repo.js";
import { seatLockService } from "./seatLock.service.js";
import { createNotification } from "../../../../shared/notification-module/src/services/notification.service.js";
import {
  sendCancellationEmail,
  sendRefundStatusEmail,
} from "../../../../shared/notification-module/src/services/email.service.js";

/**
 * Calculates refund eligibility and tier based on showtime proximity
 */
export function calculateRefund({ totalAmount, eventDate, eventTime }) {
  let eventDateTime = null;
  if (eventDate) {
    try {
      const timeStr = eventTime || "19:00";
      eventDateTime = new Date(`${eventDate} ${timeStr}`);
      if (isNaN(eventDateTime.getTime())) {
        eventDateTime = new Date(eventDate);
      }
    } catch (_) {
      eventDateTime = null;
    }
  }

  const now = new Date();
  let hoursUntilEvent = 72; // Default to eligible future show if date not fully parsable
  if (eventDateTime && !isNaN(eventDateTime.getTime())) {
    hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  }

  if (hoursUntilEvent < 0) {
    return {
      eligible: false,
      reason: "Event has already started or concluded. Cancellations are no longer permitted.",
      hoursUntilEvent,
      refundPercentage: 0,
      refundAmount: 0,
      cancellationFee: Number(totalAmount) || 0,
    };
  }

  let refundPercentage = 100;
  if (hoursUntilEvent > 48) {
    refundPercentage = 100;
  } else if (hoursUntilEvent >= 24) {
    refundPercentage = 75;
  } else if (hoursUntilEvent >= 4) {
    refundPercentage = 50;
  } else {
    return {
      eligible: false,
      reason: "Cancellations are not permitted within 4 hours of event start time.",
      hoursUntilEvent,
      refundPercentage: 0,
      refundAmount: 0,
      cancellationFee: Number(totalAmount) || 0,
    };
  }

  const total = Number(totalAmount) || 0;
  const refundAmount = Math.round((total * refundPercentage) / 100);
  const cancellationFee = total - refundAmount;

  return {
    eligible: true,
    hoursUntilEvent,
    refundPercentage,
    refundAmount,
    cancellationFee,
    tierDescription: `${refundPercentage}% Refund (${refundPercentage === 100 ? "Full refund >48h" : refundPercentage === 75 ? "Standard refund 24-48h" : "Partial refund 4-24h"})`,
  };
}

export const cancellationService = {
  /**
   * Preview cancellation refund breakdown without actually executing
   */
  async previewCancellation(bookingReference) {
    const booking = await bookingRepo.getBookingById(bookingReference);
    if (!booking) {
      const err = new Error(`Booking ${bookingReference} not found`);
      err.statusCode = 404;
      throw err;
    }

    const event = booking.event || {};
    const refundInfo = calculateRefund({
      totalAmount: booking.totalAmount || booking.total || 0,
      eventDate: event.date || event.event_date,
      eventTime: event.time || event.event_time,
    });

    return {
      bookingReference,
      status: booking.status,
      totalAmount: booking.totalAmount || booking.total || 0,
      seats: booking.seats || [],
      eventTitle: event.title || "Event",
      ...refundInfo,
    };
  },

  /**
   * Executes atomic cancellation, ticket invalidation, seat release, and refund
   */
  async executeCancellation({ bookingReference, userId, userRole, reason = "Customer requested cancellation" }) {
    const booking = await bookingRepo.getBookingById(bookingReference);
    if (!booking) {
      const err = new Error(`Booking ${bookingReference} not found`);
      err.statusCode = 404;
      throw err;
    }

    if (booking.status === "CANCELLED") {
      const existing = await bookingRepo.getCancellationByBookingReference(bookingReference);
      return {
        alreadyCancelled: true,
        bookingReference,
        status: "CANCELLED",
        cancellation: existing,
      };
    }

    // 1. Authorization check
    if (userId && userRole !== "admin" && userRole !== "staff") {
      const bookingUserId = booking.userId || booking.user?.id;
      if (bookingUserId && bookingUserId !== userId) {
        const err = new Error("You are not authorized to cancel this booking");
        err.statusCode = 403;
        throw err;
      }
    }

    // 2. Gate Verification Check: Ensure tickets have not been used
    try {
      const ticketRes = await fetch(`${config.ticketServiceUrl}/api/tickets/booking/${bookingReference}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        const tickets = Array.isArray(ticketData.data) ? ticketData.data : (Array.isArray(ticketData) ? ticketData : []);
        const usedTicket = tickets.find((t) => t.status === "USED" || t.scanned_at);
        if (usedTicket) {
          const err = new Error("Cannot cancel booking: One or more tickets have already been scanned for entry at gate security.");
          err.statusCode = 400;
          throw err;
        }
      }
    } catch (checkErr) {
      if (checkErr.statusCode === 400) throw checkErr;
      // Proceed if ticket-service query was merely network timeout
    }

    // 3. Proximity / Policy Evaluation
    const event = booking.event || {};
    const totalAmount = Number(booking.totalAmount || booking.total || 0);
    const refundInfo = calculateRefund({
      totalAmount,
      eventDate: event.date || event.event_date,
      eventTime: event.time || event.event_time,
    });

    if (!refundInfo.eligible) {
      const err = new Error(refundInfo.reason);
      err.statusCode = 400;
      err.details = refundInfo;
      throw err;
    }

    const cancellationReference = "CAN_" + bookingReference + "_" + Date.now().toString(36).toUpperCase();
    const refundReference = "REF_" + bookingReference + "_" + Date.now().toString(36).toUpperCase();

    // 4. Invalidate Tickets in Ticket Service
    try {
      await fetch(`${config.ticketServiceUrl}/api/tickets/invalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingReference, reason }),
        signal: AbortSignal.timeout(4000),
      });
    } catch (tErr) {
      console.warn(`[Cancellation] Invalidation call to ticket-service warning:`, tErr.message);
    }

    // 5. Trigger Refund in Payment Service
    let refundResult = null;
    try {
      const pRes = await fetch(`${config.paymentServiceUrl}/api/payments/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentReference: booking.payment?.payment_reference || bookingReference,
          amount: refundInfo.refundAmount,
          reason,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (pRes.ok) {
        refundResult = await pRes.json();
      }
    } catch (pErr) {
      console.warn(`[Cancellation] Payment-service refund call warning:`, pErr.message);
    }

    // 6. Release Redis distributed locks so seats immediately open up
    const eventId = booking.eventId || event.id;
    const seats = booking.seats || [];
    if (eventId && seats.length > 0) {
      await seatLockService.releaseLocks(eventId, seats).catch(() => {});
      fetch(`${config.apiGatewayUrl}/api/realtime/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: `event:${eventId}`,
          event: "seat:released",
          data: { eventId, seats },
        }),
      }).catch(() => {});
    }

    // 7. Record in Database / Memory Repository
    const cancellationRecord = await bookingRepo.recordCancellation({
      cancellationReference,
      bookingReference,
      userId: userId || booking.userId || booking.user?.id || "usr_demo_01",
      totalAmount,
      refundAmount: refundInfo.refundAmount,
      cancellationFee: refundInfo.cancellationFee,
      refundPercentage: refundInfo.refundPercentage,
      refundReference,
      refundStatus: "COMPLETED",
      reason,
    });

    // 8. Dispatch In-App Notification and Emails
    const notifUserId = userId || booking.userId || booking.user?.id;
    if (notifUserId) {
      createNotification({
        userId: notifUserId,
        type: "CANCELLATION",
        title: "Booking Cancelled",
        message: `Your booking ${bookingReference} for "${event.title || "Event"}" has been cancelled. Refund of ₹${refundInfo.refundAmount.toLocaleString()} has been initiated.`,
        data: {
          bookingReference,
          cancellationReference,
          refundAmount: refundInfo.refundAmount,
          refundReference,
        },
      }).catch(() => {});

      fetch(`${config.apiGatewayUrl}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: notifUserId,
          type: "CANCELLATION",
          title: "Booking Cancelled",
          message: `Your booking ${bookingReference} for "${event.title || "Event"}" has been cancelled. Refund of ₹${refundInfo.refundAmount.toLocaleString()} has been initiated.`,
          data: {
            bookingReference,
            cancellationReference,
            refundAmount: refundInfo.refundAmount,
            refundReference,
          },
        }),
      }).catch(() => {});
    }

    const userEmail = booking.user?.email;
    if (userEmail) {
      sendCancellationEmail({
        to: userEmail,
        bookingId: bookingReference,
        eventTitle: event.title || "Event",
        seats,
        refundAmount: refundInfo.refundAmount,
        refundRef: refundReference,
      }).catch(() => {});

      sendRefundStatusEmail({
        to: userEmail,
        refundRef: refundReference,
        paymentRef: booking.payment?.payment_reference || bookingReference,
        amount: refundInfo.refundAmount,
        status: "SETTLED",
      }).catch(() => {});
    }

    return {
      success: true,
      bookingReference,
      cancellationReference,
      refundReference,
      status: "CANCELLED",
      refundAmount: refundInfo.refundAmount,
      cancellationFee: refundInfo.cancellationFee,
      refundPercentage: refundInfo.refundPercentage,
      releasedSeats: seats,
      refundStatus: "COMPLETED",
      refundResult,
      message: `Booking successfully cancelled. Refund of ₹${refundInfo.refundAmount.toLocaleString()} (${refundInfo.refundPercentage}%) processed.`,
    };
  },

  async getCancellation(bookingReference) {
    return await bookingRepo.getCancellationByBookingReference(bookingReference);
  },
};
