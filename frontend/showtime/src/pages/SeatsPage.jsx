import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { getEventById as localGetEventById } from "../data/events";
import { getEventById as apiGetEventById, getEventSeats } from "../services/api";
import { EventPoster } from "../components/EventCard";

// ── CINEMA / MOVIE TIERS ──
const CINEMA_TIERS = [
  { id: "recliner", name: "VIP Recliner", mult: 3.5, rows: ["A", "B"], cols: 12, aisles: [3, 8], cls: "recliner" },
  { id: "prime", name: "Prime", mult: 2.0, rows: ["C", "D", "E"], cols: 16, aisles: [3, 12], cls: "prime" },
  { id: "classic", name: "Classic", mult: 1.0, rows: ["F", "G", "H", "J"], cols: 18, aisles: [4, 13], cls: "" },
];

// ── CRICKET STADIUM STANDS ──
const CRICKET_STANDS = [
  { id: "north", name: "North Stand", tag: "Pitch Straight View", mult: 2.0, rows: ["A", "B", "C"], cols: 16, aisles: [4, 11] },
  { id: "pavilion", name: "Pavilion VIP Box", tag: "Luxury Lounge & Dining", mult: 3.5, rows: ["A", "B"], cols: 14, aisles: [4, 9] },
  { id: "east", name: "East Stand", tag: "Covered Upper Tier", mult: 1.5, rows: ["A", "B", "C"], cols: 16, aisles: [4, 11] },
  { id: "west", name: "West Stand", tag: "Boundary Line Action", mult: 1.2, rows: ["A", "B", "C"], cols: 16, aisles: [4, 11] },
  { id: "south", name: "South Grandstand", tag: "Panoramic Field View", mult: 1.0, rows: ["A", "B", "C", "D"], cols: 18, aisles: [4, 13] },
];

// ── CONCERT / MUSIC PASSES & ARENA ZONES ──
const CONCERT_PASSES = [
  {
    id: "fan_pit",
    name: "Fan Pit",
    tag: "Closest to Stage",
    sub: "Front row standing barrier access directly facing the live performance stage.",
    perks: ["Front barrier access", "Dedicated queue lane", "Complimentary wristband"],
    color: "#8b5cf6",
    mult: 3.5,
    prefix: "PIT",
  },
  {
    id: "vip_deck",
    name: "VIP Lounge Deck",
    tag: "Elevated Viewing",
    sub: "Elevated platform terrace with unobstructed stage line-of-sight and bar access.",
    perks: ["Elevated deck view", "Dedicated bar counter", "Fast-track entry"],
    color: "#f59e0b",
    mult: 2.5,
    prefix: "VIP",
  },
  {
    id: "gold_standing",
    name: "Gold Zone Standing",
    tag: "Acoustic Sweet Spot",
    sub: "High-energy center arena floor with prime sound balance and crowd atmosphere.",
    perks: ["Center floor standing", "Direct stage sightline", "High-power acoustics"],
    color: "#3b82f6",
    mult: 1.6,
    prefix: "GLD",
  },
  {
    id: "silver_ga",
    name: "General Admission",
    tag: "Open Ground Lawn",
    sub: "Open lawn entry with access to festival food village and live LED projection screens.",
    perks: ["Open ground lawn access", "Food & beverage village access", "Full festival experience"],
    color: "#10b981",
    mult: 1.0,
    prefix: "GA",
  },
];

export default function SeatsPage({ user, setShowLogin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(() => localGetEventById(id));
  const [apiSoldSeats, setApiSoldSeats] = useState(null);

  const [maxQty, setMaxQty] = useState(2);
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [selected, setSelected] = useState([]);
  const [hoverTip, setHoverTip] = useState(null);

  // Cricket stand tab
  const [activeStandId, setActiveStandId] = useState("north");

  // Concert pass counts: { [passId]: number }
  const [passCounts, setPassCounts] = useState({});

  // Real-time socket state
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const category = (event?.category || "").toLowerCase();
  const eventTitle = (event?.title || "").toLowerCase();
  const isConcert = category === "music" || category === "festival" || category === "dj";
  const isCricket =
    !isConcert &&
    (category === "cricket" ||
      category === "sports" ||
      eventTitle.includes("cricket") ||
      eventTitle.includes("ipl") ||
      eventTitle.includes("t20") ||
      eventTitle.includes("match") ||
      eventTitle.includes("stadium") ||
      eventTitle.includes("vs"));

  const numPrice = typeof event?.price === "number" ? event.price : parseFloat(event?.price) || 500;

  const fetchSeats = () => {
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

    fetchSeats();
    const timer = setInterval(fetchSeats, 15000);

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
      fetchSeats();
    });

    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("seat:booked", ({ seats }) => {
      if (Array.isArray(seats)) {
        setApiSoldSeats((prev) => {
          const next = new Set(prev || []);
          seats.forEach((s) => next.add(s));
          return next;
        });
        setSelected((prev) => prev.filter((k) => !seats.includes(k.split(":")[1])));
      }
    });

    socket.on("event:seats_updated", ({ bookedSeats }) => {
      if (Array.isArray(bookedSeats)) setApiSoldSeats(new Set(bookedSeats));
    });

    return () => {
      clearInterval(timer);
      if (socket.connected) {
        socket.emit("leave:event", { eventId: id });
        socket.disconnect();
      }
    };
  }, [id, user]);

  const soldSeats = useMemo(() => {
    const set = new Set();
    if (apiSoldSeats) {
      apiSoldSeats.forEach((s) => {
        if (!s) return;
        const str = String(s);
        set.add(str);
        if (str.includes(":")) set.add(str.split(":")[1]);
        if (str.includes("-")) set.add(str.split("-")[1]);
      });
    }
    if (!event) return set;

    const eventId = String(event.id || "e001");

    // Deterministic pseudo-random float between 0.00 and 0.99
    const getSeatHash = (key) => {
      let h = 0;
      for (let i = 0; i < key.length; i++) {
        h = ((h << 5) - h) + key.charCodeAt(i);
        h |= 0;
      }
      return (Math.abs(h) % 100) / 100;
    };

    if (isCricket) {
      // In cricket stadium, scatter ~18% occupied seats so ~82% are available in every stand
      CRICKET_STANDS.forEach((stand) => {
        stand.rows.forEach((r) => {
          for (let c = 1; c <= stand.cols; c++) {
            const seatId = `${r}${c}`;
            const standKey = `${stand.id}:${seatId}`;
            const standPrefixed = `${stand.name}-${seatId}`;
            const hash = getSeatHash(`${eventId}_cricket_${stand.id}_${r}_${c}`);
            if (hash < 0.18) {
              set.add(standKey);
              set.add(standPrefixed);
            }
          }
        });
      });
    } else if (!isConcert) {
      // In cinema/theatre/comedy, scatter ~22% occupied seats so ~78% are open
      CINEMA_TIERS.forEach((tier) => {
        tier.rows.forEach((r) => {
          for (let c = 1; c <= tier.cols; c++) {
            const seatId = `${r}${c}`;
            const tierKey = `${tier.id}:${seatId}`;
            const hash = getSeatHash(`${eventId}_cinema_${tier.id}_${r}_${c}`);
            if (hash < 0.22) {
              set.add(tierKey);
              set.add(seatId);
            }
          }
        });
      });
    }
    return set;
  }, [event?.id, apiSoldSeats, isCricket, isConcert]);

  // Available seats per stand
  const standStats = useMemo(() => {
    if (!isCricket) return {};
    const stats = {};
    CRICKET_STANDS.forEach((stand) => {
      let total = stand.rows.length * stand.cols;
      let available = 0;
      stand.rows.forEach((r) => {
        for (let c = 1; c <= stand.cols; c++) {
          const seatId = `${r}${c}`;
          const key = `${stand.id}:${seatId}`;
          const standPrefixed = `${stand.name}-${seatId}`;
          const isSold = soldSeats.has(key) || soldSeats.has(standPrefixed);
          if (!isSold) available++;
        }
      });
      stats[stand.id] = { total, available };
    });
    return stats;
  }, [isCricket, soldSeats]);

  if (!event) {
    return (
      <div className="wrap pad center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div>
          <h2>Event not found</h2>
          <button className="btn-primary" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
            Back to Home
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

  const toggleSeat = (tierOrStand, seatId) => {
    const key = `${tierOrStand.id}:${seatId}`;
    const standPrefixed = `${tierOrStand.name}-${seatId}`;
    const isSold =
      soldSeats.has(key) ||
      soldSeats.has(standPrefixed) ||
      (!isCricket && soldSeats.has(seatId));
    if (isSold) return;

    if (selected.includes(key)) {
      setSelected((prev) => prev.filter((k) => k !== key));
    } else {
      let next = [];
      if (selected.length >= maxQty) {
        next = [...selected.slice(1), key];
      } else {
        next = [...selected, key];
      }
      setSelected(next);
    }
  };

  const updatePassCount = (tierId, delta) => {
    const current = passCounts[tierId] || 0;
    const nextVal = Math.max(0, current + delta);
    const totalOthers = Object.values(passCounts).reduce((a, b) => a + b, 0) - current;
    if (totalOthers + nextVal > 8) return;

    setPassCounts((prev) => ({
      ...prev,
      [tierId]: nextVal,
    }));
  };

  let totalPrice = 0;
  let totalCount = 0;
  let selectedBreakdown = [];

  if (isConcert) {
    CONCERT_PASSES.forEach((p) => {
      const cnt = passCounts[p.id] || 0;
      if (cnt > 0) {
        const pPrice = Math.round(numPrice * p.mult);
        totalPrice += pPrice * cnt;
        totalCount += cnt;
        selectedBreakdown.push({
          id: p.id,
          name: p.name,
          count: cnt,
          unitPrice: pPrice,
          total: pPrice * cnt,
        });
      }
    });
  } else if (isCricket) {
    totalCount = selected.length;
    totalPrice = selected.reduce((sum, key) => {
      const [standId] = key.split(":");
      const stand = CRICKET_STANDS.find((s) => s.id === standId);
      return sum + Math.round(numPrice * (stand?.mult || 1));
    }, 0);
  } else {
    totalCount = selected.length;
    totalPrice = selected.reduce((sum, key) => {
      const [tierId] = key.split(":");
      const tier = CINEMA_TIERS.find((t) => t.id === tierId);
      return sum + Math.round(numPrice * (tier?.mult || 1));
    }, 0);
  }

  const proceed = () => {
    if (!user) {
      if (setShowLogin) setShowLogin(true);
      return;
    }

    let tickets = [];

    if (isConcert) {
      CONCERT_PASSES.forEach((p) => {
        const cnt = passCounts[p.id] || 0;
        for (let i = 1; i <= cnt; i++) {
          const passId = `${p.prefix}-${Math.floor(100 + Math.random() * 900)}`;
          tickets.push({
            seatId: passId,
            tierLabel: p.name,
            tierName: p.name,
            price: Math.round(numPrice * p.mult),
          });
        }
      });
    } else if (isCricket) {
      tickets = selected.map((key) => {
        const [standId, seatId] = key.split(":");
        const stand = CRICKET_STANDS.find((s) => s.id === standId);
        return {
          seatId: `${stand?.name || "Stand"}-${seatId}`,
          tierLabel: stand?.name || "Stadium Seat",
          tierName: stand?.name || "Stadium Seat",
          price: Math.round(numPrice * (stand?.mult || 1)),
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
          price: Math.round(numPrice * (tier?.mult || 1)),
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
      {/* ── TOP HEADER BAR ── */}
      <section className="seat-top">
        <button className="back" onClick={() => navigate(-1)} aria-label="Go back">
          ‹
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{event.title}</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.85 }}>
            {event.venue}, {event.city} · {dateStr}, {event.time}
          </p>
        </div>

        {!isConcert && (
          <button
            className="qty-chip"
            onClick={() => setShowQtyModal(true)}
            id="seat-qty-btn"
          >
            {maxQty} {maxQty === 1 ? "Ticket" : "Tickets"} ▾
          </button>
        )}
      </section>

      {/* =========================================================================
          1. CONCERT & MUSIC FESTIVAL TICKETING (Aesthetic 2-Column Booking Experience)
          ========================================================================= */}
      {isConcert && (
        <div style={{ maxWidth: 1120, margin: "24px auto 90px", padding: "0 20px" }}>
          {/* Main 2-Column Container */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(300px, 1fr)", gap: 28, alignItems: "start" }}>
            
            {/* Left Column: Venue Layout & Passes */}
            <div>
              {/* Venue Arena Layout Guide */}
              <div
                style={{
                  background: "#18181b",
                  borderRadius: 12,
                  padding: "20px 24px",
                  color: "#ffffff",
                  marginBottom: 24,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#a1a1aa" }}>
                    Stage & Arena Standing Layout
                  </span>
                  <span style={{ fontSize: 11, color: "#71717a" }}>
                    General Admission & Standing Zones
                  </span>
                </div>

                {/* Stage Area */}
                <div
                  style={{
                    background: "linear-gradient(90deg, #3f3f46 0%, #71717a 50%, #3f3f46 100%)",
                    borderRadius: 6,
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: "1.5px",
                    color: "#f4f4f5",
                    marginBottom: 10,
                  }}
                >
                  STAGE
                </div>

                {/* Standing Zones Layout Diagram */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", borderRadius: 6, padding: "12px 6px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#fde68a" }}>
                    VIP Deck (Left)
                  </div>
                  <div style={{ background: "rgba(139, 92, 246, 0.2)", border: "1px solid #8b5cf6", borderRadius: 6, padding: "14px 8px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#ddd6fe" }}>
                    Fan Pit (Front Stage)
                  </div>
                  <div style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", borderRadius: 6, padding: "12px 6px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#fde68a" }}>
                    VIP Deck (Right)
                  </div>
                </div>

                <div style={{ background: "rgba(59, 130, 246, 0.15)", border: "1px solid #3b82f6", borderRadius: 6, padding: "10px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#bfdbfe", marginBottom: 8 }}>
                  Gold Zone (Main Arena Floor)
                </div>

                <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid #10b981", borderRadius: 6, padding: "10px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#a7f3d0" }}>
                  General Admission (Open Lawn)
                </div>
              </div>

              {/* Ticket Category Cards */}
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 14px" }}>
                  Select Passes
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {CONCERT_PASSES.map((p) => {
                  const price = Math.round(event.price * p.mult);
                  const count = passCounts[p.id] || 0;

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: "#ffffff",
                        border: count > 0 ? "1.5px solid var(--red, #f84464)" : "1px solid #e4e4e7",
                        borderRadius: 10,
                        padding: "18px 20px",
                        position: "relative",
                        overflow: "hidden",
                        boxShadow: count > 0 ? "0 4px 16px rgba(248, 68, 100, 0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {/* Left accent bar */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          background: count > 0 ? "var(--red, #f84464)" : p.color,
                        }}
                      />

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                              {p.name}
                            </h4>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 4,
                                background: "#f4f4f5",
                                color: "#52525b",
                              }}
                            >
                              {p.tag}
                            </span>
                          </div>

                          <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#71717a", lineHeight: 1.4 }}>
                            {p.sub}
                          </p>

                          {/* Perks */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                            {p.perks.map((perk, idx) => (
                              <span key={idx} style={{ fontSize: 11, color: "#52525b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#a1a1aa" }} />
                                {perk}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Price & Stepper */}
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
                            ₹{price.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 1 }}>
                            per pass
                          </div>

                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              background: "#f4f4f5",
                              borderRadius: 8,
                              padding: "3px",
                              marginTop: 10,
                              border: "1px solid #e4e4e7",
                            }}
                          >
                            <button
                              onClick={() => updatePassCount(p.id, -1)}
                              disabled={count <= 0}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: "none",
                                background: count > 0 ? "#ffffff" : "transparent",
                                color: count > 0 ? "var(--ink)" : "#a1a1aa",
                                fontSize: 15,
                                fontWeight: 700,
                                cursor: count > 0 ? "pointer" : "default",
                                boxShadow: count > 0 ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                              }}
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700, fontSize: 14 }}>
                              {count}
                            </span>
                            <button
                              onClick={() => updatePassCount(p.id, 1)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: "none",
                                background: "var(--red, #f84464)",
                                color: "#ffffff",
                                fontSize: 15,
                                fontWeight: 700,
                                cursor: "pointer",
                                boxShadow: "0 1px 3px rgba(248, 68, 100, 0.3)",
                              }}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Sticky Booking Summary Card */}
            <div style={{ position: "sticky", top: 80 }}>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e4e4e7",
                  borderRadius: 12,
                  padding: 22,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                }}
              >
                {/* Event Mini Poster & Info */}
                <div style={{ display: "flex", gap: 14, paddingBottom: 16, borderBottom: "1px solid #f4f4f5" }}>
                  <div style={{ width: 64, height: 86, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                    <EventPoster event={event} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
                      {event.title}
                    </h4>
                    <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
                      {dateStr} · {event.time}
                    </div>
                    <div style={{ fontSize: 12, color: "#71717a" }}>
                      {event.venue}, {event.city}
                    </div>
                  </div>
                </div>

                {/* Selected Breakdown */}
                <div style={{ padding: "16px 0", borderBottom: "1px solid #f4f4f5" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
                    Selected Passes
                  </div>

                  {selectedBreakdown.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#a1a1aa", textAlign: "center", padding: "14px 0" }}>
                      No passes selected yet.<br />Choose passes to continue.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selectedBreakdown.map((item) => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "var(--ink)" }}>
                            {item.count}x {item.name}
                          </span>
                          <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                            ₹{item.total.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price Total */}
                <div style={{ paddingTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#52525b" }}>
                      Total Amount
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "var(--red, #f84464)" }}>
                      ₹{Math.round(totalPrice).toLocaleString()}
                    </span>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={proceed}
                    disabled={totalCount === 0}
                    style={{
                      width: "100%",
                      padding: "13px",
                      fontSize: 14,
                      fontWeight: 700,
                      borderRadius: 8,
                      opacity: totalCount === 0 ? 0.5 : 1,
                      cursor: totalCount === 0 ? "not-allowed" : "pointer",
                    }}
                    id="concert-checkout-btn"
                  >
                    {totalCount > 0 ? `Proceed to Checkout (${totalCount} ${totalCount === 1 ? "Pass" : "Passes"})` : "Select Passes to Continue"}
                  </button>

                  <div style={{ fontSize: 11, color: "#a1a1aa", textAlign: "center", marginTop: 12 }}>
                    Instant M-Ticket Confirmation · 100% Secure
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          2. CRICKET STADIUM TICKETING (Stand-by-Stand Stadium View & Seat Grid)
          ========================================================================= */}
      {isCricket && (
        <div style={{ maxWidth: 960, margin: "20px auto 100px", padding: "0 16px" }}>
          {/* Stand selector tabs */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Select Stand / Enclosure
              </span>
              <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>
                {standStats[activeStand.id]?.available || 0} seats available in {activeStand.name}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
              {CRICKET_STANDS.map((s) => {
                const active = activeStandId === s.id;
                const price = Math.round(numPrice * s.mult);
                const avail = standStats[s.id]?.available ?? 0;

                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveStandId(s.id)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: active ? "1.5px solid var(--red, #f84464)" : "1px solid #e4e4e7",
                      background: active ? "#ffffff" : "#f4f4f5",
                      cursor: "pointer",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      boxShadow: active ? "0 2px 8px rgba(248, 68, 100, 0.15)" : "none",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: active ? "var(--red, #f84464)" : "var(--ink)" }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                      ₹{price.toLocaleString()} · {s.tag}
                    </div>
                    <div style={{ fontSize: 10, color: avail > 0 ? "#16a34a" : "#dc2626", fontWeight: 700, marginTop: 3 }}>
                      {avail > 0 ? `${avail} open` : "Filling fast"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seat Grid */}
          <div className="seat-scroll" style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e4e4e7", padding: "24px 16px" }}>
            <div className="seat-map">
              <div className="tier">
                <div className="tier-name" style={{ textAlign: "center", borderBottom: "1px solid #f4f4f5", paddingBottom: 10, marginBottom: 18 }}>
                  <strong style={{ color: "var(--ink)", fontSize: 14 }}>{activeStand.name}</strong> — ₹{Math.round(numPrice * activeStand.mult).toLocaleString()} per seat
                  <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                    {activeStand.tag} · {standStats[activeStand.id]?.available || 0} seats open for booking
                  </div>
                </div>

                {activeStand.rows.map((rowLetter) => (
                  <div className="seat-row" key={rowLetter}>
                    <span className="row-l">{rowLetter}</span>
                    {Array.from({ length: activeStand.cols }, (_, ci) => {
                      const seatNum = ci + 1;
                      const seatId = `${rowLetter}${seatNum}`;
                      const key = `${activeStand.id}:${seatId}`;
                      const standPrefixed = `${activeStand.name}-${seatId}`;
                      const isSold = soldSeats.has(key) || soldSeats.has(standPrefixed);
                      const isSel = selected.includes(key);

                      let seatClass = "seat";
                      if (isSold) seatClass += " sold";
                      else if (isSel) seatClass += " sel";

                      return (
                        <span
                          key={seatId}
                          className="seat-cell"
                          style={{ marginRight: activeStand.aisles?.includes(ci) ? 20 : 0 }}
                        >
                          <button
                            className={seatClass}
                            disabled={isSold}
                            onClick={() => toggleSeat(activeStand, seatId)}
                            onMouseEnter={() =>
                              setHoverTip({
                                id: seatId,
                                price: numPrice * activeStand.mult,
                                isSold,
                              })
                            }
                            onMouseLeave={() => setHoverTip(null)}
                            id={`seat-${seatId}`}
                            title={isSold ? `Seat ${rowLetter}${seatNum} (Sold Out)` : `Seat ${rowLetter}${seatNum} (₹${Math.round(numPrice * activeStand.mult)})`}
                          >
                            {seatNum}
                          </button>

                          {hoverTip?.id === seatId && (
                            <em className="seat-tip">
                              {isSold
                                ? `${rowLetter}${seatNum} · Sold Out`
                                : `${rowLetter}${seatNum} · ₹${Math.round(hoverTip.price).toLocaleString()}`}
                            </em>
                          )}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Pitch Orientation Guide */}
              <div style={{ textAlign: "center", margin: "24px auto 8px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    padding: "7px 18px",
                    borderRadius: 20,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", letterSpacing: "1px", textTransform: "uppercase" }}>
                    Ground & 22-Yard Cricket Pitch Facing This Direction
                  </span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                </div>
              </div>

              <div className="seat-legend" style={{ marginTop: 14 }}>
                <span>
                  <i className="seat" /> Available
                </span>
                <span>
                  <i className="seat sel" /> Selected
                </span>
                <span>
                  <i className="seat sold" /> Sold Out
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. CINEMA & AUDITORIUM SEATING (Screen at Top, Curved Rows)
          ========================================================================= */}
      {!isConcert && !isCricket && (
        <div className="seat-scroll">
          <div className="seat-map">
            {CINEMA_TIERS.map((tier) => (
              <div className="tier" key={tier.id}>
                <div className="tier-name">
                  ₹{Math.round(numPrice * tier.mult).toLocaleString()} {tier.name}
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
                          style={{ marginRight: tier.aisles?.includes(ci) ? 20 : 0 }}
                        >
                          <button
                            className={seatClass}
                            disabled={isSold}
                            onClick={() => toggleSeat(tier, seatId)}
                            onMouseEnter={() =>
                              setHoverTip({
                                id: seatId,
                                price: numPrice * tier.mult,
                                isSold,
                              })
                            }
                            onMouseLeave={() => setHoverTip(null)}
                            id={`seat-${seatId}`}
                            title={isSold ? `Seat ${rowLetter}${seatNum} (Sold Out)` : `Seat ${rowLetter}${seatNum} (₹${Math.round(numPrice * tier.mult)})`}
                          >
                            {seatNum}
                          </button>

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

            <div className="screen-wrap">
              <svg viewBox="0 0 400 50" preserveAspectRatio="none">
                <path d="M10 40 Q200 5 390 40" stroke="#cbd5e1" strokeWidth="2.5" fill="none" />
              </svg>
              <p>All eyes this way please</p>
            </div>

            <div className="seat-legend">
              <span>
                <i className="seat" /> Available
              </span>
              <span>
                <i className="seat sel" /> Selected
              </span>
              <span>
                <i className="seat sold" /> Sold Out
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING CHECKOUT BAR (For Cricket & Cinema) ── */}
      {!isConcert && totalCount > 0 && (
        <div className="pay-bar">
          <div>
            <small style={{ color: "var(--ink2)", fontWeight: 700 }}>
              {totalCount} {totalCount > 1 ? "Tickets" : "Ticket"}: {selected.map((k) => k.split(":")[1]).slice(0, 3).join(", ")}
              {selected.length > 3 ? ` +${selected.length - 3} more` : ""}
            </small>
            <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 2 }}>
              Total: <strong style={{ color: "var(--red)", fontSize: 17 }}>₹{Math.round(totalPrice).toLocaleString()}</strong>
            </div>
          </div>

          <div className="pb-actions">
            <button
              className="btn-primary big"
              onClick={proceed}
              id="proceed-pay-btn"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}

      {/* ── QUANTITY MODAL ── */}
      {showQtyModal && (
        <div
          className="modal-bg"
          onClick={() => setShowQtyModal(false)}
        >
          <div
            className="modal qty"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 360, padding: 24 }}
          >
            <h3>How Many Seats?</h3>
            <div className="qty-row" style={{ marginTop: 16 }}>
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
              style={{ width: "100%", padding: "10px", marginTop: 20 }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
