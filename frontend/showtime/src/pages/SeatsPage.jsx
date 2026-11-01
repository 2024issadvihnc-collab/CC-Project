import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { getEventById as localGetEventById } from "../data/events";
import { getEventById as apiGetEventById, getEventSeats } from "../services/api";

// ── AUDITORIUM / CINEMA TIERS ──
const CINEMA_TIERS = [
  { id: "recliner", name: "VIP Lounge (Recliner)", mult: 3.5, rows: ["A", "B"], cols: 12, aisles: [3, 8], cls: "recliner" },
  { id: "prime", name: "Premium Tier", mult: 2.0, rows: ["C", "D", "E"], cols: 16, aisles: [3, 12], cls: "prime" },
  { id: "classic", name: "Standard Tier", mult: 1.0, rows: ["F", "G", "H", "J"], cols: 18, aisles: [4, 13], cls: "" },
];

// ── CRICKET STADIUM STANDS ──
const CRICKET_STANDS = [
  {
    id: "pavilion",
    name: "Pavilion End / VIP Hospitality Box",
    shortName: "Pavilion VIP",
    desc: "Behind bowler's arm · Air-conditioned luxury lounge · Premium gourmet dining",
    mult: 3.5,
    rows: ["PA", "PB"],
    cols: 14,
    aisles: [4, 9],
  },
  {
    id: "north",
    name: "North Stand (Sachin Tendulkar Stand)",
    shortName: "North Stand",
    desc: "Cheer atmosphere · Direct pitch straight-drive view",
    mult: 2.0,
    rows: ["NA", "NB", "NC"],
    cols: 16,
    aisles: [4, 11],
  },
  {
    id: "east",
    name: "East Stand (Covered Upper Tier)",
    shortName: "East Stand",
    desc: "Panoramic 360° stadium vision · Full shaded covered roof",
    mult: 1.5,
    rows: ["EA", "EB", "EC"],
    cols: 16,
    aisles: [4, 11],
  },
  {
    id: "west",
    name: "West Stand (Boundary Line / Lower Bowl)",
    shortName: "West Stand",
    desc: "Boundary rope edge action · Field level view",
    mult: 1.2,
    rows: ["WA", "WB", "WC"],
    cols: 16,
    aisles: [4, 11],
  },
  {
    id: "south",
    name: "South Stand (Grandstand Upper)",
    shortName: "Grandstand",
    desc: "High-angle tactical field view · High-energy fan chants",
    mult: 1.0,
    rows: ["SA", "SB", "SC", "SD"],
    cols: 18,
    aisles: [4, 13],
  },
];

// ── CONCERT / MUSIC FESTIVAL PASSES & STANDING ZONES ──
const CONCERT_PASS_TIERS = [
  {
    id: "fan_pit",
    name: "Fan Pit (Front Stage Standing)",
    tag: "CLOSEST TO ARTIST",
    color: "#a855f7",
    desc: "Exclusive barrier standing right in front of the live stage. Dedicated pit entrance lane & souvenir wristband.",
    mult: 3.5,
    prefix: "PIT",
    capacity: 250,
  },
  {
    id: "vip_deck",
    name: "VIP Lounge & Elevated Deck",
    tag: "PREMIUM HOSPITALITY",
    color: "#eab308",
    desc: "Elevated viewing terrace with direct stage line-of-sight. Includes 2 complimentary beverage tokens & fast-track entry.",
    mult: 2.5,
    prefix: "VIP",
    capacity: 400,
  },
  {
    id: "gold_standing",
    name: "Gold Zone (Main Arena Standing)",
    tag: "ACOUSTIC SWEET SPOT",
    color: "#3b82f6",
    desc: "High-octane center floor experience with booming sound clarity and energetic festival crowd.",
    mult: 1.6,
    prefix: "GLD",
    capacity: 1200,
  },
  {
    id: "silver_ga",
    name: "Silver / General Admission (GA Lawn)",
    tag: "OPEN FIELD LAWN",
    color: "#10b981",
    desc: "Wide open field lawn access with massive visual LED screens, food stalls, and festival village.",
    mult: 1.0,
    prefix: "GA",
    capacity: 3500,
  },
];

export default function SeatsPage({ user, setShowLogin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(() => localGetEventById(id));
  const [apiSoldSeats, setApiSoldSeats] = useState(null);

  const [maxQty, setMaxQty] = useState(2);
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [selected, setSelected] = useState([]); // Array of strings (e.g. "tier:seatId" or "pass:passId")
  const [hoverTip, setHoverTip] = useState(null);

  // Cricket Stand tab state
  const [activeStandId, setActiveStandId] = useState("north");

  // Concert pass counts: { [passId]: quantity }
  const [concertPassCounts, setConcertPassCounts] = useState({});

  // Real-time Socket.IO state
  const [socketConnected, setSocketConnected] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");
  const socketRef = useRef(null);

  // Categorize event layout
  const category = (event?.category || "").toLowerCase();
  const isConcert = category === "music" || category === "festival" || category === "dj";
  const isCricket = category === "cricket" || category === "sports";

  const fetchAuthoritativeSeats = () => {
    getEventSeats(id).then((seatData) => {
      if (seatData) {
        const booked = seatData.bookedSeats || seatData.soldSeats || [];
        setApiSoldSeats(new Set(booked));
      }
    });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    apiGetEventById(id).then((data) => {
      if (data) setEvent(data);
    });

    fetchAuthoritativeSeats();

    // Periodic auto-update fallback every 15 seconds
    const interval = setInterval(fetchAuthoritativeSeats, 15000);

    // ── Socket.IO Real-time Connection ──
    const socketBase = import.meta.env.VITE_WS_URL || window.location.origin.replace(":5173", ":5000");
    const socket = io(socketBase, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: {
        token: user?.token,
        userId: user?.id || (user?.phone ? `usr_${user.phone.replace(/\D/g, "").slice(-4)}` : undefined),
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("join:event", { eventId: id });
      fetchAuthoritativeSeats();
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    // Real-time permanent booking auto-update from other customers
    socket.on("seat:booked", ({ seats }) => {
      if (Array.isArray(seats)) {
        setApiSoldSeats((prev) => {
          const next = new Set(prev || []);
          seats.forEach((s) => next.add(s));
          return next;
        });
        // If any of the user's selected seats was just taken, deselect it
        setSelected((prev) => prev.filter((k) => !seats.includes(k.split(":")[1])));
      }
    });

    socket.on("event:seats_updated", ({ bookedSeats }) => {
      if (Array.isArray(bookedSeats)) {
        setApiSoldSeats(new Set(bookedSeats));
      }
    });

    socket.on("seat:lock_failed", ({ seatId }) => {
      setConflictMessage(`Seat ${seatId} was just booked by another user.`);
      setTimeout(() => setConflictMessage(""), 4500);
    });

    return () => {
      clearInterval(interval);
      if (socket.connected) {
        socket.emit("leave:event", { eventId: id });
        socket.disconnect();
      }
    };
  }, [id, user]);

  // Compute sold/booked seats
  const soldSeats = useMemo(() => {
    const set = new Set();
    if (apiSoldSeats) {
      apiSoldSeats.forEach((s) => set.add(s));
    }

    if (!event) return set;
    const filled = event.filledPct || 0.6;

    if (isCricket) {
      CRICKET_STANDS.forEach((stand) => {
        stand.rows.forEach((r) => {
          for (let c = 1; c <= stand.cols; c++) {
            const hash = ((r.charCodeAt(0) * 31 + c * 17 + event.price) % 100) / 100;
            if (hash < filled) {
              set.add(`${stand.id}:${r}${c}`);
              set.add(`${r}${c}`);
            }
          }
        });
      });
    } else if (!isConcert) {
      CINEMA_TIERS.forEach((tier) => {
        tier.rows.forEach((r) => {
          for (let c = 1; c <= tier.cols; c++) {
            const hash = ((r.charCodeAt(0) * 31 + c * 17 + event.price) % 100) / 100;
            if (hash < filled) {
              set.add(`${tier.id}:${r}${c}`);
              set.add(`${r}${c}`);
            }
          }
        });
      });
    }
    return set;
  }, [event?.id, event?.filledPct, apiSoldSeats, isCricket, isConcert]);

  if (!event) {
    return (
      <div className="wrap pad center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div>
          <h2>Event not found</h2>
          <button className="btn-primary" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  const dateStr = new Date(event.date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // ── SEAT TOGGLE FOR SEATED EVENTS (Cricket & Cinema) ──
  const toggleSeat = (tierOrStand, seatId) => {
    const key = `${tierOrStand.id}:${seatId}`;
    const isSold = soldSeats.has(key) || soldSeats.has(seatId);
    if (isSold) return;

    if (selected.includes(key)) {
      setSelected((prev) => prev.filter((k) => k !== key));
    } else {
      let nextSelected = [];
      if (selected.length >= maxQty) {
        nextSelected = [...selected.slice(1), key];
      } else {
        nextSelected = [...selected, key];
      }
      setSelected(nextSelected);
    }
  };

  // ── CONCERT PASS COUNTER TOGGLE ──
  const updateConcertPassCount = (tierId, delta) => {
    const current = concertPassCounts[tierId] || 0;
    const nextCount = Math.max(0, current + delta);
    const totalCurrentCount = Object.values(concertPassCounts).reduce((a, b) => a + b, 0) - current;

    if (totalCurrentCount + nextCount > 8) {
      setConflictMessage("Maximum 8 festival/concert passes per order.");
      setTimeout(() => setConflictMessage(""), 3500);
      return;
    }

    setConcertPassCounts((prev) => ({
      ...prev,
      [tierId]: nextCount,
    }));
  };

  // ── TOTAL PRICE CALCULATION ──
  let totalPrice = 0;
  let totalTicketCount = 0;
  let ticketSummaries = [];

  if (isConcert) {
    CONCERT_PASS_TIERS.forEach((tier) => {
      const count = concertPassCounts[tier.id] || 0;
      if (count > 0) {
        const tierPrice = Math.round(event.price * tier.mult);
        totalPrice += tierPrice * count;
        totalTicketCount += count;
        ticketSummaries.push(`${count}x ${tier.name}`);
      }
    });
  } else if (isCricket) {
    totalTicketCount = selected.length;
    totalPrice = selected.reduce((sum, key) => {
      const [standId] = key.split(":");
      const stand = CRICKET_STANDS.find((s) => s.id === standId);
      return sum + Math.round(event.price * (stand?.mult || 1));
    }, 0);
    ticketSummaries = selected.map((k) => k.split(":")[1]);
  } else {
    totalTicketCount = selected.length;
    totalPrice = selected.reduce((sum, key) => {
      const [tierId] = key.split(":");
      const tier = CINEMA_TIERS.find((t) => t.id === tierId);
      return sum + Math.round(event.price * (tier?.mult || 1));
    }, 0);
    ticketSummaries = selected.map((k) => k.split(":")[1]);
  }

  // ── PROCEED TO CHECKOUT ──
  const proceed = () => {
    if (!user) {
      if (setShowLogin) setShowLogin(true);
      return;
    }

    let tickets = [];

    if (isConcert) {
      CONCERT_PASS_TIERS.forEach((tier) => {
        const count = concertPassCounts[tier.id] || 0;
        for (let i = 1; i <= count; i++) {
          const passId = `${tier.prefix}-${Math.floor(100 + Math.random() * 900)}`;
          tickets.push({
            seatId: passId,
            tierLabel: tier.name,
            tierName: tier.name,
            price: Math.round(event.price * tier.mult),
          });
        }
      });
    } else if (isCricket) {
      tickets = selected.map((key) => {
        const [standId, seatId] = key.split(":");
        const stand = CRICKET_STANDS.find((s) => s.id === standId);
        return {
          seatId,
          tierLabel: stand?.shortName || stand?.name || "Stadium Seat",
          tierName: stand?.name || "Stadium Seat",
          price: Math.round(event.price * (stand?.mult || 1)),
        };
      });
    } else {
      tickets = selected.map((key) => {
        const [tierId, seatId] = key.split(":");
        const tier = CINEMA_TIERS.find((t) => t.id === tierId);
        return {
          seatId,
          tierLabel: tier?.name || "Standard",
          tierName: tier?.name || "Standard",
          price: Math.round(event.price * (tier?.mult || 1)),
        };
      });
    }

    if (tickets.length === 0) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    navigate(`/checkout/${event.id}`, { state: { tickets, event } });
  };

  const activeStand = CRICKET_STANDS.find((s) => s.id === activeStandId) || CRICKET_STANDS[0];

  return (
    <main className="seat-pg">
      {/* ── TOP BAR ── */}
      <section className="seat-top">
        <button className="back" onClick={() => navigate(-1)} aria-label="Go back">
          ‹
        </button>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2>{event.title}</h2>
            {/* Live Socket.IO Status Badge */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: socketConnected ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)",
                color: socketConnected ? "#16a34a" : "#dc2626",
                padding: "2px 8px",
                borderRadius: 12,
              }}
              title={socketConnected ? "Real-time seat availability connected via Socket.IO" : "Reconnecting to live updates..."}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: socketConnected ? "#16a34a" : "#dc2626" }} />
              {socketConnected ? "Live Available" : "Connecting..."}
            </span>
          </div>
          <p>
            {event.venue}, {event.city} | {dateStr}, {event.time} ·{" "}
            <strong style={{ color: "var(--red)" }}>
              {isConcert ? "CONCERT PASSES & STANDING ZONES" : isCricket ? "CRICKET STADIUM SEATING" : "AUDITORIUM SEATING"}
            </strong>
          </p>
        </div>

        {!isConcert && (
          <button
            className="qty-chip"
            onClick={() => setShowQtyModal(true)}
            id="seat-qty-btn"
            title="Change number of tickets"
          >
            {maxQty} {maxQty === 1 ? "Ticket" : "Tickets"} ▾
          </button>
        )}
      </section>

      {/* Conflict Toast Notification */}
      <AnimatePresence>
        {conflictMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              padding: "10px 18px",
              borderRadius: 8,
              maxWidth: 500,
              margin: "12px auto 0",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            {conflictMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          LAYOUT 1: CONCERT / MUSIC FESTIVAL PASSES & STANDING ARENA
          ========================================================================= */}
      {isConcert && (
        <div style={{ maxWidth: 940, margin: "24px auto 100px", padding: "0 16px" }}>
          {/* Visual Stage & Arena Diagram */}
          <div
            style={{
              background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
              borderRadius: 16,
              padding: "28px 20px 20px",
              border: "1px solid rgba(255,255,255,0.08)",
              textAlign: "center",
              boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
              marginBottom: 28,
            }}
          >
            {/* Live Stage */}
            <div
              style={{
                background: "linear-gradient(90deg, #f43f5e 0%, #ec4899 50%, #f43f5e 100%)",
                borderRadius: 10,
                padding: "12px",
                color: "#ffffff",
                fontWeight: 800,
                letterSpacing: 2,
                fontSize: 14,
                boxShadow: "0 0 25px rgba(244,63,94,0.5)",
                display: "inline-block",
                width: "80%",
                maxWidth: 480,
              }}
            >
              LIVE STAGE / ARTIST DECK
            </div>

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "8px 0 20px" }}>
              Audio-Visual Rig · Laser Canopy · Performance Zone
            </div>

            {/* Standing Zones Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12, maxWidth: 680, margin: "0 auto" }}>
              <div
                style={{
                  background: "rgba(234, 179, 8, 0.12)",
                  border: "1px dashed #eab308",
                  borderRadius: 10,
                  padding: "16px 8px",
                  color: "#fde047",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                VIP Deck (Left)
              </div>
              <div
                style={{
                  background: "rgba(168, 85, 247, 0.18)",
                  border: "2px solid #a855f7",
                  borderRadius: 10,
                  padding: "20px 12px",
                  color: "#d8b4fe",
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: "0 0 16px rgba(168,85,247,0.25)",
                }}
              >
                FAN PIT (Standing Front)
                <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8, marginTop: 4 }}>
                  Direct Barrier View
                </div>
              </div>
              <div
                style={{
                  background: "rgba(234, 179, 8, 0.12)",
                  border: "1px dashed #eab308",
                  borderRadius: 10,
                  padding: "16px 8px",
                  color: "#fde047",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                VIP Deck (Right)
              </div>
            </div>

            {/* Gold Zone */}
            <div
              style={{
                background: "rgba(59, 130, 246, 0.12)",
                border: "1px solid #3b82f6",
                borderRadius: 10,
                padding: "14px",
                color: "#93c5fd",
                fontSize: 13,
                fontWeight: 700,
                maxWidth: 680,
                margin: "12px auto 0",
              }}
            >
              GOLD ZONE (Arena Floor Standing)
            </div>

            {/* Silver GA */}
            <div
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid #10b981",
                borderRadius: 10,
                padding: "16px",
                color: "#6ee7b7",
                fontSize: 13,
                fontWeight: 700,
                maxWidth: 680,
                margin: "12px auto 0",
              }}
            >
              SILVER / GENERAL ADMISSION (GA Open Lawn)
            </div>
          </div>

          {/* Ticket Tier Cards */}
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: "var(--ink)" }}>
            Select Passes & Standing Tiers
          </h3>

          <div style={{ display: "grid", gap: 14 }}>
            {CONCERT_PASS_TIERS.map((tier) => {
              const tierPrice = Math.round(event.price * tier.mult);
              const count = concertPassCounts[tier.id] || 0;

              return (
                <div
                  key={tier.id}
                  style={{
                    background: count > 0 ? "rgba(244, 63, 94, 0.05)" : "var(--bg-card, #ffffff)",
                    border: count > 0 ? "2px solid var(--red, #f84464)" : "1px solid var(--line, #e2e8f0)",
                    borderRadius: 14,
                    padding: "18px 20px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    transition: "all 0.2s ease",
                    boxShadow: count > 0 ? "0 4px 16px rgba(248, 68, 100, 0.15)" : "0 2px 6px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ flex: "1 1 320px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          background: tier.color,
                          color: "#ffffff",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 6,
                          letterSpacing: 0.5,
                        }}
                      >
                        {tier.tag}
                      </span>
                      <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{tier.name}</h4>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--mut)", lineHeight: 1.4 }}>
                      {tier.desc}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "var(--mut)", fontWeight: 600 }}>PRICE PER PASS</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>₹{tierPrice.toLocaleString()}</div>
                    </div>

                    {/* Quantity Selector Counter */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "var(--bg-sub, #f1f5f9)",
                        borderRadius: 10,
                        padding: "4px",
                        border: "1px solid var(--line, #cbd5e1)",
                      }}
                    >
                      <button
                        onClick={() => updateConcertPassCount(tier.id, -1)}
                        disabled={count <= 0}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: "none",
                          background: count > 0 ? "var(--red, #f84464)" : "transparent",
                          color: count > 0 ? "#ffffff" : "var(--mut)",
                          fontSize: 18,
                          fontWeight: 700,
                          cursor: count > 0 ? "pointer" : "not-allowed",
                          display: "grid",
                          placeItems: "center",
                        }}
                        aria-label="Decrease tickets"
                      >
                        −
                      </button>
                      <span style={{ width: 36, textAlign: "center", fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>
                        {count}
                      </span>
                      <button
                        onClick={() => updateConcertPassCount(tier.id, 1)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          border: "none",
                          background: "var(--red, #f84464)",
                          color: "#ffffff",
                          fontSize: 18,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                        }}
                        aria-label="Increase tickets"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          LAYOUT 2: CRICKET STADIUM ARCHITECTURE (Pitch, Stands & Oval Ground)
          ========================================================================= */}
      {isCricket && (
        <div style={{ maxWidth: 1080, margin: "16px auto 100px", padding: "0 16px" }}>
          {/* Cricket Ground & Pitch Visualization */}
          <div
            style={{
              background: "radial-gradient(ellipse at center, #15803d 0%, #166534 60%, #14532d 100%)",
              borderRadius: 20,
              padding: "24px 20px",
              border: "3px solid #22c55e",
              boxShadow: "0 12px 36px rgba(22, 101, 52, 0.4)",
              color: "#ffffff",
              textAlign: "center",
              marginBottom: 20,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Boundary Rope & 30 Yard Circle */}
            <div
              style={{
                border: "2px dashed rgba(255,255,255,0.4)",
                borderRadius: "50%",
                maxWidth: 420,
                height: 180,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {/* Cricket Pitch */}
              <div
                style={{
                  background: "#d4b996",
                  width: 50,
                  height: 120,
                  borderRadius: 4,
                  border: "1px solid #b89366",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                }}
              >
                {/* Top Stumps */}
                <div style={{ width: 20, height: 4, background: "#ffffff", borderRadius: 2 }} title="Bowling Crease / Stumps" />
                <span style={{ fontSize: 9, color: "#5c4033", fontWeight: 800 }}>PITCH</span>
                {/* Bottom Stumps */}
                <div style={{ width: 20, height: 4, background: "#ffffff", borderRadius: 2 }} title="Batting Crease / Stumps" />
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 12, letterSpacing: 1 }}>
              {event.venue?.toUpperCase() || "INTERNATIONAL CRICKET STADIUM"} · 22-YARD PITCH & OUTFIELD
            </div>
          </div>

          {/* Stand Tabs */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--mut)", marginBottom: 8 }}>
              SELECT STADIUM STAND:
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
              {CRICKET_STANDS.map((stand) => {
                const isActive = activeStandId === stand.id;
                const price = Math.round(event.price * stand.mult);

                return (
                  <button
                    key={stand.id}
                    onClick={() => setActiveStandId(stand.id)}
                    style={{
                      flex: "1 0 auto",
                      background: isActive ? "var(--red, #f84464)" : "var(--bg-card, #ffffff)",
                      color: isActive ? "#ffffff" : "var(--ink)",
                      border: isActive ? "1px solid var(--red, #f84464)" : "1px solid var(--line, #e2e8f0)",
                      padding: "10px 16px",
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      boxShadow: isActive ? "0 4px 12px rgba(248, 68, 100, 0.25)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{stand.shortName}</div>
                    <div style={{ fontSize: 11, opacity: isActive ? 0.9 : 0.7 }}>₹{price.toLocaleString()}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Stand Description Banner */}
          <div
            style={{
              background: "var(--bg-sub, #f8fafc)",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--ink2)",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span><strong>{activeStand.name}</strong> — {activeStand.desc}</span>
            <span style={{ fontWeight: 800, color: "var(--red)", fontSize: 14 }}>
              ₹{Math.round(event.price * activeStand.mult).toLocaleString()}
            </span>
          </div>

          {/* Cricket Stand Seats Grid */}
          <div className="seat-scroll">
            <div className="seat-map" style={{ minWidth: 640 }}>
              {activeStand.rows.map((rowLetter) => (
                <div className="seat-row" key={rowLetter}>
                  <span className="row-l">{rowLetter}</span>
                  {Array.from({ length: activeStand.cols }, (_, ci) => {
                    const seatNum = ci + 1;
                    const seatId = `${rowLetter}${seatNum}`;
                    const key = `${activeStand.id}:${seatId}`;
                    const isSold = soldSeats.has(key) || soldSeats.has(seatId);
                    const isSel = selected.includes(key);

                    let seatClass = "seat prime";
                    if (isSold) seatClass += " sold";
                    else if (isSel) seatClass += " sel";

                    return (
                      <span
                        key={seatId}
                        className="seat-cell"
                        style={{ marginRight: activeStand.aisles?.includes(ci) ? 22 : 0 }}
                      >
                        <motion.button
                          className={seatClass}
                          disabled={isSold}
                          whileHover={!isSold ? { scale: 1.2 } : {}}
                          whileTap={!isSold ? { scale: 0.9 } : {}}
                          animate={isSel ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                          onClick={() => toggleSeat(activeStand, seatId)}
                          onMouseEnter={() =>
                            setHoverTip({
                              id: seatId,
                              price: event.price * activeStand.mult,
                              tier: activeStand.shortName,
                              isSold,
                            })
                          }
                          onMouseLeave={() => setHoverTip(null)}
                          aria-label={`Seat ${seatId}`}
                          id={`seat-${seatId}`}
                        >
                          {seatNum}
                        </motion.button>

                        {hoverTip?.id === seatId && (
                          <em className="seat-tip">
                            {isSold
                              ? `${seatId} · Sold Out`
                              : `${activeStand.shortName} ${seatId} · ₹${Math.round(hoverTip.price).toLocaleString()}`}
                          </em>
                        )}
                      </span>
                    );
                  })}
                </div>
              ))}

              {/* 3-State Legend */}
              <div className="seat-legend" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, marginTop: 24 }}>
                <span>
                  <i className="seat" style={{ verticalAlign: "middle" }} /> Available
                </span>
                <span>
                  <i className="seat sel" style={{ verticalAlign: "middle" }} /> Selected (You)
                </span>
                <span>
                  <i className="seat sold" style={{ verticalAlign: "middle" }} /> Sold Out
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LAYOUT 3: AUDITORIUM / CINEMA HALL (Screen at Top, Curved Rows)
          ========================================================================= */}
      {!isConcert && !isCricket && (
        <div className="seat-scroll">
          <div className="seat-map">
            {CINEMA_TIERS.map((tier) => (
              <div className="tier" key={tier.id}>
                <div className="tier-name">
                  ₹{Math.round(event.price * tier.mult).toLocaleString()} {tier.name}
                </div>

                {tier.rows.map((rowLetter) => (
                  <div className="seat-row" key={rowLetter}>
                    <span className="row-l">{rowLetter}</span>
                    {Array.from({ length: tier.cols }, (_, ci) => {
                      const seatNum = ci + 1;
                      const seatId = `${rowLetter}${seatNum}`;
                      const key = `${tier.id}:${seatId}`;
                      const isSold = soldSeats.has(key) || soldSeats.has(seatId);
                      const isSel = selected.includes(key);

                      let seatClass = `seat ${tier.cls}`;
                      if (isSold) seatClass += " sold";
                      else if (isSel) seatClass += " sel";

                      return (
                        <span
                          key={seatId}
                          className="seat-cell"
                          style={{ marginRight: tier.aisles?.includes(ci) ? 24 : 0 }}
                        >
                          <motion.button
                            className={seatClass}
                            disabled={isSold}
                            whileHover={!isSold ? { scale: 1.2 } : {}}
                            whileTap={!isSold ? { scale: 0.9 } : {}}
                            animate={isSel ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                            onClick={() => toggleSeat(tier, seatId)}
                            onMouseEnter={() =>
                              setHoverTip({
                                id: seatId,
                                price: event.price * tier.mult,
                                tier: tier.name,
                                isSold,
                              })
                            }
                            onMouseLeave={() => setHoverTip(null)}
                            aria-label={`Seat ${seatId}`}
                            id={`seat-${seatId}`}
                          >
                            {seatNum}
                          </motion.button>

                          {hoverTip?.id === seatId && (
                            <em className="seat-tip">
                              {isSold
                                ? `${seatId} · Sold Out`
                                : `${seatId} · ₹${Math.round(hoverTip.price).toLocaleString()}`}
                            </em>
                          )}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}

            {/* Stage / Screen curve */}
            <div className="screen-wrap">
              <svg viewBox="0 0 400 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="scr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f84464" stopOpacity=".7" />
                    <stop offset="1" stopColor="#f84464" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M10 50 Q200 -5 390 50 L390 60 Q200 12 10 60Z" fill="url(#scr)" />
                <path d="M10 52 Q200 -3 390 52" stroke="var(--red)" strokeWidth="3" fill="none" />
              </svg>
              <p>ALL EYES THIS WAY — SILVER SCREEN</p>
            </div>

            {/* 3-State Legend (No withheld / temporarily held) */}
            <div className="seat-legend" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
              <span>
                <i className="seat" style={{ verticalAlign: "middle" }} /> Available
              </span>
              <span>
                <i className="seat sel" style={{ verticalAlign: "middle" }} /> Selected (You)
              </span>
              <span>
                <i className="seat sold" style={{ verticalAlign: "middle" }} /> Sold Out
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING CHECKOUT ACTION BAR ── */}
      <AnimatePresence>
        {totalTicketCount > 0 && (
          <motion.div
            className="pay-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <small style={{ color: "var(--ink2)", fontWeight: 700 }}>
                  {totalTicketCount} {totalTicketCount > 1 ? "Tickets" : "Ticket"}: {ticketSummaries.slice(0, 3).join(", ")}
                  {ticketSummaries.length > 3 ? ` +${ticketSummaries.length - 3} more` : ""}
                </small>
              </div>
              <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 2 }}>
                Total Payable: <strong style={{ color: "var(--red)", fontSize: 18 }}>₹{Math.round(totalPrice).toLocaleString()}</strong>
              </div>
            </div>

            <div className="pb-actions">
              <button
                className="btn-primary big"
                onClick={proceed}
                id="proceed-pay-btn"
              >
                Proceed to Checkout →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HOW MANY SEATS MODAL (for Cinema & Stadium) ── */}
      <AnimatePresence>
        {showQtyModal && (
          <motion.div
            className="modal-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowQtyModal(false)}
          >
            <motion.div
              className="modal qty"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>How Many Seats?</h3>
              <div className="veh" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "var(--red)" }}>
                SELECT QUANTITY
              </div>
              <div className="qty-row">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((q) => (
                  <button
                    key={q}
                    className={maxQty === q ? "on" : ""}
                    onClick={() => {
                      setMaxQty(q);
                      if (selected.length > q) setSelected(selected.slice(0, q));
                      setShowQtyModal(false);
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button
                className="btn-primary"
                onClick={() => setShowQtyModal(false)}
                style={{ width: "100%", padding: "12px", marginTop: 16 }}
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
