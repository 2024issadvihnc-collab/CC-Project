import { eventRepo } from "../database/repositories/event.repo.js";
import { redisService } from "./redis.service.js";

// Clean categories without emojis
export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "music", label: "Music" },
  { id: "cricket", label: "Cricket" },
  { id: "sports", label: "Sports" },
  { id: "dj", label: "DJ & Nightlife" },
  { id: "festival", label: "Festival" },
  { id: "comedy", label: "Comedy" },
];

export const CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad",
  "Chennai", "Kolkata", "Pune", "Ahmedabad",
  "Jaipur", "Goa", "Shillong", "Indore",
];

// Seat tier configuration matching frontend
export const TIERS = [
  { id: "recliner", name: "VIP Lounge", mult: 3.5, rows: ["A", "B"], cols: 12, aisles: [3, 8], cls: "recliner" },
  { id: "prime", name: "Premium Tier", mult: 2.0, rows: ["C", "D", "E"], cols: 16, aisles: [3, 12], cls: "prime" },
  { id: "classic", name: "Standard Tier", mult: 1.0, rows: ["F", "G", "H", "J"], cols: 18, aisles: [4, 13], cls: "" },
];

export const eventService = {
  getCategories() {
    return CATEGORIES;
  },

  getCities() {
    return CITIES;
  },

  async getAllEvents(params = {}) {
    const cacheKey = `events:list:${JSON.stringify(params)}`;
    // Only cache simple non-search queries
    const canCache = !params.q;

    if (canCache) {
      const cached = await redisService.get(cacheKey);
      if (cached) return cached;
    }

    const events = await eventRepo.getAllEvents(params);

    if (canCache && events && events.length > 0) {
      await redisService.set(cacheKey, events, 60); // 60s TTL
    }

    return events;
  },

  async getEventById(id) {
    if (!id) return null;
    const cacheKey = `events:detail:${id}`;
    const cached = await redisService.get(cacheKey);
    if (cached) return cached;

    const event = await eventRepo.getEventById(id);
    if (event) {
      await redisService.set(cacheKey, event, 30); // 30s TTL
    }
    return event;
  },

  async getEventSeats(id) {
    const event = await this.getEventById(id);
    if (!event) return null;

    const soldSet = new Set();
    const filled = event.filledPct || 0.6;

    // 1. Calculate base pattern for initial realistic simulation
    TIERS.forEach((tier) => {
      tier.rows.forEach((r) => {
        for (let c = 1; c <= tier.cols; c++) {
          const hash = ((r.charCodeAt(0) * 31 + c * 17 + event.price) % 100) / 100;
          if (hash < filled) {
            soldSet.add(`${tier.id}:${r}${c}`);
          }
        }
      });
    });

    // 2. Fetch all real dynamically confirmed bookings from Database
    const bookedSeats = await eventRepo.getEventBookedSeats(id);
    bookedSeats.forEach((seatId) => {
      TIERS.forEach((t) => {
        if (t.rows.some((row) => seatId.startsWith(row))) {
          soldSet.add(`${t.id}:${seatId}`);
        }
      });
    });

    return {
      eventId: event.id,
      tiers: TIERS,
      soldSeats: Array.from(soldSet),
      basePrice: event.price,
    };
  },
};

