import { eventService } from "../services/event.service.js";
import { sendSuccess, sendError } from "../../../../shared/common-utils/response.js";

export const eventController = {
  async getAll(req, res) {
    try {
      const { category, city, q, sort } = req.query;
      const events = await eventService.getAllEvents({ category, city, q, sort });
      // To match existing frontend direct json expectation
      return res.json(events);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const event = await eventService.getEventById(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      return res.json(event);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async getSeats(req, res) {
    try {
      const { id } = req.params;
      const seatsData = await eventService.getEventSeats(id);
      if (!seatsData) {
        return res.status(404).json({ error: "Event not found" });
      }
      return res.json(seatsData);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async create(req, res) {
    try {
      const created = await eventService.createEvent(req.body);
      return sendSuccess(res, created, "Event created", 201);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async delete(req, res) {
    try {
      const deleted = await eventService.deleteEvent(req.params.id);
      return sendSuccess(res, { deleted }, "Event deleted");
    } catch (err) {
      return sendError(res, err, 400);
    }
  },
};

