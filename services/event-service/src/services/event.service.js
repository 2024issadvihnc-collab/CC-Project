import { eventRepo } from "../database/repositories/event.repo.js";
import { cacheService } from "./redis.service.js";

function buildDefaultSeatLayout(event) {
  const basePrice = Number(event.price) || 500;
  return [
    {
      id: "vip",
      label: "VIP Front Row",
      price: Math.round(basePrice * 1.8),
      color: "#f84464",
      rows: [
        { row: "A", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { row: "B", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      ],
    },
    {
      id: "premium",
      label: "Premium",
      price: Math.round(basePrice * 1.3),
      color: "#8b5cf6",
      rows: [
        { row: "C", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { row: "D", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { row: "E", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
      ],
    },
    {
      id: "gold",
      label: "Gold",
      price: basePrice,
      color: "#06b6d4",
      rows: [
        { row: "F", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { row: "G", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { row: "H", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
      ],
    },
  ];
}

export const eventService = {
  async getAllEvents(filters) {
    const cacheKey = `events:list:${JSON.stringify(filters || {})}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const events = await eventRepo.getAllEvents(filters);
    await cacheService.set(cacheKey, events, 60);
    return events;
  },

  async getEventById(id) {
    const cacheKey = `event:${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const event = await eventRepo.getEventById(id);
    if (event) {
      await cacheService.set(cacheKey, event, 120);
    }
    return event;
  },

  async getEventSeats(id) {
    const event = await eventRepo.getEventById(id);
    if (!event) return null;

    const bookedSeats = await eventRepo.getEventBookedSeats(id);
    const layout = buildDefaultSeatLayout(event);

    return {
      eventId: id,
      eventTitle: event.title,
      layout,
      bookedSeats,
    };
  },

  async createEvent(eventData) {
    const created = await eventRepo.createEvent(eventData);
    await cacheService.del("events:list:*");
    return created;
  },

  async deleteEvent(id) {
    const deleted = await eventRepo.deleteEvent(id);
    await cacheService.del(`event:${id}`);
    return deleted;
  },
};

