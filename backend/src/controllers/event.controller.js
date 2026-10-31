import { eventService } from "../services/event.service.js";

export const eventController = {
  getCategories(req, res) {
    res.json(eventService.getCategories());
  },

  getCities(req, res) {
    res.json(eventService.getCities());
  },

  async getAllEvents(req, res, next) {
    try {
      const { category, city, q, sort } = req.query;
      const events = await eventService.getAllEvents({ category, city, q, sort });
      res.json(events);
    } catch (err) {
      next(err);
    }
  },

  async getEventById(req, res, next) {
    try {
      const { id } = req.params;
      const event = await eventService.getEventById(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (err) {
      next(err);
    }
  },

  async getEventSeats(req, res, next) {
    try {
      const { id } = req.params;
      const seatsData = await eventService.getEventSeats(id);
      if (!seatsData) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(seatsData);
    } catch (err) {
      next(err);
    }
  },
};

