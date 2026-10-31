import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import jwt from "jsonwebtoken";
import { config } from "../config/env.config.js";

let ioInstance = null;
let redisPubClient = null;
let redisSubClient = null;
let isRedisAvailable = false;

// Fallback in-memory structures if Redis cluster is offline during local dev
const fallbackLocks = new Map();
const permanentlyBookedSeats = new Set();

/**
 * Initializes Redis clients and Socket.IO Redis Adapter for multi-instance horizontal scaling
 */
function initializeRedisAdapter(io) {
  try {
    const redisUrl = config.redisUrl || "redis://localhost:6379";
    redisPubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
      connectTimeout: 2000,
      lazyConnect: true,
    });

    redisSubClient = redisPubClient.duplicate();

    redisPubClient.connect().then(() => {
      isRedisAvailable = true;
      console.log(`[Socket.IO Redis] Pub client connected to ${redisUrl}`);
      if (redisSubClient.status === "wait") {
        redisSubClient.connect().then(() => {
          io.adapter(createAdapter(redisPubClient, redisSubClient));
          console.log("[Socket.IO Redis Adapter] Multi-instance scaling adapter active");
        }).catch(() => {});
      }
    }).catch(() => {
      isRedisAvailable = false;
      console.warn("[Socket.IO Redis] Running with in-memory adapter (Redis offline)");
    });

    redisPubClient.on("error", () => { isRedisAvailable = false; });
    redisSubClient.on("error", () => { isRedisAvailable = false; });
  } catch (err) {
    isRedisAvailable = false;
    console.warn("[Socket.IO Redis] Adapter initialization fallback:", err.message);
  }
}

export function setupSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });

  ioInstance = io;

  // Initialize Redis Adapter for AWS EC2 / Container multi-instance clustering
  initializeRedisAdapter(io);

  // JWT Authentication & Identification Middleware
  io.use((socket, next) => {
    const authHeader = socket.handshake.headers?.authorization;
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.user = decoded;
        socket.userId = decoded.id;
        socket.authenticated = true;
      } catch (err) {
        // Log authentication warning but allow guest socket connection for public viewing
        socket.authenticated = false;
      }
    }

    if (!socket.userId) {
      socket.userId =
        socket.handshake.auth?.userId ||
        socket.handshake.query?.userId ||
        `guest_${socket.id.slice(0, 8)}`;
      socket.authenticated = Boolean(socket.user);
    }

    next();
  });

  io.on("connection", (socket) => {
    const clientId = socket.userId;
    console.log(`[Socket.IO Gateway] Client connected: ${socket.id} (User: ${clientId}, Auth: ${Boolean(socket.authenticated)})`);

    // 1. Join Event Room
    socket.on("join:event", async ({ eventId }) => {
      if (!eventId) return;
      const room = `event:${eventId}`;
      socket.join(room);
      console.log(`[Socket.IO Gateway] ${socket.id} joined room ${room}`);

      const now = Date.now();
      const currentHolds = [];

      // Query Redis if available for active seat holds
      if (isRedisAvailable && redisPubClient) {
        try {
          const keys = await redisPubClient.keys(`lock:seat:${eventId}:*`);
          for (const key of keys) {
            const raw = await redisPubClient.get(key);
            if (raw) {
              const lock = JSON.parse(raw);
              if (lock.expiresAt > now) {
                currentHolds.push({
                  seatId: lock.seatId,
                  lockedBy: lock.lockedBy,
                  expiresAt: lock.expiresAt,
                  isMine: lock.lockedBy === clientId,
                });
              }
            }
          }
        } catch (_) {}
      } else {
        // In-memory fallback
        for (const [key, lock] of fallbackLocks.entries()) {
          if (lock.eventId === eventId) {
            if (lock.expiresAt > now) {
              currentHolds.push({
                seatId: lock.seatId,
                lockedBy: lock.lockedBy,
                expiresAt: lock.expiresAt,
                isMine: lock.lockedBy === clientId,
              });
            } else {
              fallbackLocks.delete(key);
            }
          }
        }
      }

      socket.emit("event:seat_snapshot", {
        eventId,
        heldSeats: currentHolds,
      });
    });

    // 2. Leave Event Room
    socket.on("leave:event", ({ eventId }) => {
      if (!eventId) return;
      const room = `event:${eventId}`;
      socket.leave(room);
      console.log(`[Socket.IO Gateway] ${socket.id} left room ${room}`);
    });

    // 3. Temporarily Hold / Lock Seat (Redis with TTL & Mutex)
    socket.on("seat:hold", async ({ eventId, seatId, durationSeconds = 120 }, callback) => {
      if (!eventId || !seatId) {
        if (typeof callback === "function") callback({ success: false, reason: "Missing eventId or seatId" });
        return;
      }

      const lockKey = `${eventId}:${seatId}`;
      const redisKey = `lock:seat:${eventId}:${seatId}`;
      const now = Date.now();
      const expiresAt = now + durationSeconds * 1000;

      // Check if permanently booked
      if (permanentlyBookedSeats.has(lockKey)) {
        const errorPayload = { success: false, seatId, reason: "Seat is already booked and unavailable" };
        socket.emit("seat:lock_failed", errorPayload);
        if (typeof callback === "function") callback(errorPayload);
        return;
      }

      // ── REDIS DISTRIBUTED SEAT LOCK ──
      if (isRedisAvailable && redisPubClient) {
        try {
          const lockPayload = JSON.stringify({
            eventId,
            seatId,
            lockedBy: clientId,
            expiresAt,
          });

          // Atomic SET if Not eXists with expiry (NX EX)
          const acquired = await redisPubClient.set(redisKey, lockPayload, "EX", durationSeconds, "NX");

          if (!acquired) {
            // Check existing lock to verify if it belongs to current user renewing
            const existingRaw = await redisPubClient.get(redisKey);
            const existing = existingRaw ? JSON.parse(existingRaw) : null;

            if (existing && existing.lockedBy === clientId) {
              // Renew lock
              await redisPubClient.set(redisKey, lockPayload, "EX", durationSeconds);
            } else {
              const errorPayload = {
                success: false,
                seatId,
                reason: "Seat is currently held by another user",
                lockedBy: existing?.lockedBy,
                expiresAt: existing?.expiresAt,
              };
              socket.emit("seat:lock_failed", errorPayload);
              if (typeof callback === "function") callback(errorPayload);
              return;
            }
          }

          // Broadcast to event room across all server instances
          io.to(`event:${eventId}`).emit("seat:held", {
            eventId,
            seatId,
            lockedBy: clientId,
            expiresAt,
          });

          if (typeof callback === "function") {
            callback({ success: true, seatId, expiresAt });
          }
          return;
        } catch (err) {
          console.warn("[Socket.IO Redis] Seat lock Redis error, using fallback:", err.message);
        }
      }

      // ── IN-MEMORY FALLBACK ──
      const existing = fallbackLocks.get(lockKey);
      if (existing && existing.expiresAt > now && existing.lockedBy !== clientId) {
        const errorPayload = {
          success: false,
          seatId,
          reason: "Seat is currently held by another user",
          lockedBy: existing.lockedBy,
          expiresAt: existing.expiresAt,
        };
        socket.emit("seat:lock_failed", errorPayload);
        if (typeof callback === "function") callback(errorPayload);
        return;
      }

      if (existing?.timer) {
        clearTimeout(existing.timer);
      }

      const timer = setTimeout(() => {
        if (fallbackLocks.has(lockKey) && !permanentlyBookedSeats.has(lockKey)) {
          fallbackLocks.delete(lockKey);
          console.log(`[Socket.IO Gateway] Lock expired for ${lockKey}`);
          io.to(`event:${eventId}`).emit("seat:released", { eventId, seatId });
        }
      }, durationSeconds * 1000);

      fallbackLocks.set(lockKey, {
        eventId,
        seatId,
        lockedBy: clientId,
        expiresAt,
        timer,
      });

      io.to(`event:${eventId}`).emit("seat:held", {
        eventId,
        seatId,
        lockedBy: clientId,
        expiresAt,
      });

      if (typeof callback === "function") {
        callback({ success: true, seatId, expiresAt });
      }
    });

    // 4. Release Seat Lock (with Ownership Verification)
    socket.on("seat:release", async ({ eventId, seatId }, callback) => {
      if (!eventId || !seatId) return;
      const lockKey = `${eventId}:${seatId}`;
      const redisKey = `lock:seat:${eventId}:${seatId}`;

      // Redis lock release
      if (isRedisAvailable && redisPubClient) {
        try {
          const existingRaw = await redisPubClient.get(redisKey);
          if (existingRaw) {
            const existing = JSON.parse(existingRaw);
            if (existing.lockedBy !== clientId) {
              console.warn(`[Socket.IO Gateway] Unauthorized release attempt for ${redisKey} by ${clientId}`);
              if (typeof callback === "function") {
                callback({ success: false, reason: "Cannot release seat held by another user" });
              }
              return;
            }
            await redisPubClient.del(redisKey);
          }
        } catch (_) {}
      }

      // In-memory fallback cleanup
      const existing = fallbackLocks.get(lockKey);
      if (existing && existing.lockedBy !== clientId) {
        console.warn(`[Socket.IO Gateway] Unauthorized release attempt for ${lockKey} by ${clientId}`);
        if (typeof callback === "function") {
          callback({ success: false, reason: "Cannot release seat held by another user" });
        }
        return;
      }

      if (existing?.timer) {
        clearTimeout(existing.timer);
      }
      fallbackLocks.delete(lockKey);

      console.log(`[Socket.IO Gateway] Seat released: ${lockKey} by ${clientId}`);
      io.to(`event:${eventId}`).emit("seat:released", { eventId, seatId });

      if (typeof callback === "function") {
        callback({ success: true, seatId });
      }
    });

    // 5. Disconnect
    socket.on("disconnect", () => {
      console.log(`[Socket.IO Gateway] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Broadcasts an event to a specific room or all connected clients across EC2 instances
 */
export async function broadcastToRoom(room, eventName, payload) {
  if (!ioInstance) return;

  // Handle permanent booking confirmations
  if (eventName === "seat:booked") {
    const { eventId, seats } = payload;
    if (eventId && Array.isArray(seats)) {
      for (const seat of seats) {
        const lockKey = `${eventId}:${seat}`;
        const redisKey = `lock:seat:${eventId}:${seat}`;
        permanentlyBookedSeats.add(lockKey);

        if (isRedisAvailable && redisPubClient) {
          try {
            await redisPubClient.del(redisKey);
          } catch (_) {}
        }

        const lock = fallbackLocks.get(lockKey);
        if (lock?.timer) clearTimeout(lock.timer);
        fallbackLocks.delete(lockKey);
      }
    }
  }

  // Handle cancellations and seat releases
  if (eventName === "seat:released") {
    const { eventId, seats, seatId } = payload;
    const targetSeats = Array.isArray(seats) ? seats : [seatId].filter(Boolean);
    for (const seat of targetSeats) {
      const lockKey = `${eventId}:${seat}`;
      const redisKey = `lock:seat:${eventId}:${seat}`;
      permanentlyBookedSeats.delete(lockKey);

      if (isRedisAvailable && redisPubClient) {
        try {
          await redisPubClient.del(redisKey);
        } catch (_) {}
      }

      const lock = fallbackLocks.get(lockKey);
      if (lock?.timer) clearTimeout(lock.timer);
      fallbackLocks.delete(lockKey);
    }
  }

  ioInstance.to(room).emit(eventName, payload);
  console.log(`[Socket.IO Gateway] Broadcasted "${eventName}" to room "${room}"`, payload);
}

export function getIO() {
  return ioInstance;
}
