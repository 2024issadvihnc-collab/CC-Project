import { ticketService } from "../services/ticket.service.js";
import { sendSuccess, sendError } from "../../../../shared/common-utils/response.js";

export const ticketController = {
  async generate(req, res) {
    try {
      const result = await ticketService.generateTicketsForBooking(req.body);
      return sendSuccess(res, result, "Tickets generated successfully", 201);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async getByRef(req, res) {
    try {
      const ticket = await ticketService.getTicket(req.params.ref);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      return sendSuccess(res, ticket);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async getByBooking(req, res) {
    try {
      const tickets = await ticketService.getTicketsByBooking(req.params.bookingRef);
      return sendSuccess(res, tickets);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async validate(req, res) {
    try {
      const identifier = req.body.ticketReference || req.body.token || req.body.rawQr || req.body.identifier;
      const result = await ticketService.validateTicket(identifier);
      if (!result.valid) {
        return res.status(400).json({ success: false, ...result });
      }
      return sendSuccess(res, result, result.message);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async scan(req, res) {
    try {
      const identifier = req.params.ref || req.body.ticketReference || req.body.token || req.body.rawQr || req.body.identifier;
      const gateLocation = req.body.gateLocation || "MAIN_ENTRANCE";
      const scannedBy = req.staff?.id || req.body.scannedBy || "staff_gate_01";

      const result = await ticketService.scanTicket(identifier, gateLocation, scannedBy);
      if (!result.valid) {
        return res.status(400).json({ success: false, ...result });
      }
      return sendSuccess(res, result, result.message || "Ticket admitted successfully");
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async invalidate(req, res) {
    try {
      const { bookingReference, reason } = req.body;
      if (!bookingReference) {
        return res.status(400).json({ error: "bookingReference is required" });
      }
      const count = await ticketService.invalidateTicketsForBooking(bookingReference, reason);
      return sendSuccess(res, { bookingReference, invalidatedCount: count }, "Tickets invalidated successfully");
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async getRecentScans(req, res) {
    try {
      const limit = parseInt(req.query.limit || "20", 10);
      const scans = await ticketService.getRecentScans(limit);
      return sendSuccess(res, scans);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },
};
