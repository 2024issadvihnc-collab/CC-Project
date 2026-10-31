import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getFeatured, events as initialEvents, categories } from "../data/events";
import { getEvents } from "../services/api";
import EventCard, { EventPoster } from "../components/EventCard";

const HERO_LIGHT_GRADIENTS = {
  music: "linear-gradient(135deg, #ffffff 0%, #faf5ff 45%, #f3e8ff 100%)",
  cricket: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)",
  sports: "linear-gradient(135deg, #ffffff 0%, #eff6ff 45%, #dbeafe 100%)",
  dj: "linear-gradient(135deg, #ffffff 0%, #faf5ff 45%, #ede9fe 100%)",
  festival: "linear-gradient(135deg, #ffffff 0%, #fffbeb 45%, #fef3c7 100%)",
  comedy: "linear-gradient(135deg, #ffffff 0%, #fff7ed 45%, #ffedd5 100%)",
};

const OFFERS = [
  { code: "SHOW20", title: "20% OFF", desc: "Up to ₹200 on first booking", bg: "linear-gradient(135deg,#ff5e3a,#ff8c42)" },
  { code: "MUSIC50", title: "₹50 FLAT OFF", desc: "On all live concert tickets", bg: "linear-gradient(135deg,#a855f7,#6366f1)" },
  { code: "SPORT10", title: "10% CASHBACK", desc: "On cricket & sports matches", bg: "linear-gradient(135deg,#0d9488,#14b8a6)" },
  { code: "DILJIT", title: "EARLY ACCESS", desc: "Diljit Aura Tour special offer", bg: "linear-gradient(135deg,#d97706,#f59e0b)" },
];

function Rail({ title, sub, link, children }) {
  const rowRef = useRef(null);
  const scroll = (dir) => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: dir * 640, behavior: "smooth" });
    }
  };

  return (
    <section className="rail">
      <div className="rail-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {link}
      </div>
      <div className="rail-wrap">
        <button className="arr l" onClick={() => scroll(-1)} aria-label="Previous">
          ‹
        </button>
        <div className="rail-row" ref={rowRef}>
          {children}
        </div>
        <button className="arr r" onClick={() => scroll(1)} aria-label="Next">
          ›
        </button>
      </div>
    </section>
  );
}

export default function Home({ city }) {
  const navigate = useNavigate();
  const [allEvents, setAllEvents] = useState(initialEvents);
  const [heroIdx, setHeroIdx] = useState(0);
  const [activeCat, setActiveCat] = useState("all");
  const [copied, setCopied] = useState(null);

  // Fetch dynamic events from backend
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    getEvents().then((data) => {
      if (data && data.length) {
        setAllEvents(data);
      }
    });
  }, []);

  const isAllCities = !city || city === "All" || city === "All Cities";

  // Filter master event list strictly by selected city (or all cities)
  const visibleEvents = allEvents.filter((e) =>
    isAllCities ? true : e.city?.toLowerCase() === city.toLowerCase()
  );

  // Trending in City (or across India)
  const cityEvents = visibleEvents.filter((e) =>
    activeCat === "all" ? true : e.category === activeCat
  );

  // Filtered lists for each category rail
  const musicEvents = visibleEvents.filter((e) => e.category === "music");
  const sportsEvents = visibleEvents.filter((e) => ["cricket", "sports"].includes(e.category));
  const djEvents = visibleEvents.filter((e) => e.category === "dj");
  const festivalEvents = visibleEvents.filter((e) => ["festival", "comedy"].includes(e.category));
  const comingSoonEvents = visibleEvents.filter((e) => e.filledPct < 0.6);

  // Featured hero slides strictly aligned with selected city
  const featured = isAllCities
    ? allEvents.filter((e) => ["e001", "e002", "e007", "e011", "e005"].includes(e.id))
    : visibleEvents.length > 0
    ? visibleEvents
    : allEvents.filter((e) => ["e001", "e002", "e007", "e011", "e005"].includes(e.id));

  const heroEvent =
    featured[heroIdx % Math.max(1, featured.length)] ||
    visibleEvents[0] ||
    allEvents[0] ||
    initialEvents[0];

  // Auto-advance hero
  useEffect(() => {
    if (!featured.length) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % featured.length), 5500);
    return () => clearInterval(t);
  }, [featured.length]);

  const handleBook = (event) => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    navigate(`/event/${event.id}`);
  };

  const copyOffer = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const dateStr = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const heroBg = HERO_LIGHT_GRADIENTS[heroEvent.category] || HERO_LIGHT_GRADIENTS.music;

  return (
    <main style={{ paddingBottom: 60 }}>
      {/* ── UNIFORM LIGHT HERO CAROUSEL ── */}
      <section className="hero">
        <div className="wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={heroIdx}
              className="hero-slide"
              style={{ background: heroBg }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <div className="hero-glow" />

              <div className="hero-text">
                <span className="hero-tag">
                  {heroEvent.category}
                </span>

                <motion.h2
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {heroEvent.title}
                </motion.h2>

                <motion.h3
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  {heroEvent.subtitle}
                </motion.h3>

                <motion.div
                  className="hero-meta"
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <span>Date: <strong>{dateStr(heroEvent.date)}</strong></span>
                  <span>Time: <strong>{heroEvent.time}</strong></span>
                  <span>Venue: <strong>{heroEvent.venue}, {heroEvent.city}</strong></span>
                  <span>Rating: <strong>{heroEvent.rating} / 5</strong> ({heroEvent.votes.toLocaleString()} reviews)</span>
                </motion.div>

                <motion.div
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  <div className="hero-price">
                    From <strong>₹{heroEvent.price.toLocaleString()}</strong>
                  </div>

                  <div className="hero-actions">
                    <button
                      className="btn-primary"
                      onClick={() => handleBook(heroEvent)}
                      id={`hero-book-${heroEvent.id}`}
                    >
                      Book Tickets
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => navigate(`/event/${heroEvent.id}`)}
                      id={`hero-details-${heroEvent.id}`}
                    >
                      View Details →
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Event poster visual on the right */}
              <motion.div
                className="hero-poster"
                initial={{ opacity: 0, scale: 0.92, rotate: 2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", damping: 18 }}
                onClick={() => handleBook(heroEvent)}
                style={{ cursor: "pointer" }}
              >
                <EventPoster event={heroEvent} />
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Dots Indicator */}
          <div className="dots">
            {featured.map((item, i) => (
              <button
                key={item.id || i}
                className={i === heroIdx ? "on" : ""}
                onClick={() => setHeroIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                id={`hero-dot-${i}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="wrap">
        {/* Category Filter Chips (Clean without emojis) */}
        <div className="chips" id="category-chips">
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip${activeCat === c.id ? " on" : ""}`}
              onClick={() => setActiveCat(c.id)}
              id={`cat-chip-${c.id}`}
            >
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* ── RAIL 1: TRENDING IN CITY ── */}
        <Rail
          title={isAllCities ? "Trending Across India" : `Trending Now in ${city}`}
          sub={
            cityEvents.length > 0
              ? isAllCities
                ? `${cityEvents.length} live experiences across India`
                : `${cityEvents.length} events in ${city}`
              : `No live events found in ${city} for this category`
          }
          link={<Link to={activeCat === "all" ? "/events" : `/events?cat=${activeCat}`} className="link-btn">See all →</Link>}
        >
          {cityEvents.length > 0 ? (
            cityEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={handleBook} />
            ))
          ) : (
            <div style={{ padding: "28px 24px", color: "#64748b", fontSize: "14px", background: "#f8fafc", borderRadius: "12px", border: "1.5px dashed #cbd5e1", width: "100%", textAlign: "center" }}>
              No {activeCat === "all" ? "" : `${activeCat} `}events currently scheduled in <strong>{city}</strong>. Select <strong>All Cities</strong> in the top-right corner to see all events across India.
            </div>
          )}
        </Rail>

        {/* ── RAIL 2: OFFERS ── */}
        <Rail
          title="Offers for You"
          sub="Click any coupon code to copy"
        >
          {OFFERS.map((o) => (
            <button
              key={o.code}
              className="offer"
              style={{ background: o.bg }}
              onClick={() => copyOffer(o.code)}
              id={`offer-${o.code}`}
              title="Click to copy coupon code"
            >
              <b>{o.title}</b>
              <span>{o.desc}</span>
              <code>{copied === o.code ? "COPIED" : o.code}</code>
            </button>
          ))}
        </Rail>

        {/* ── RAIL 3: MUSIC & CONCERTS ── */}
        {(isAllCities || musicEvents.length > 0) && (
          <Rail
            title={isAllCities ? "Music & Concerts" : `Music & Concerts in ${city}`}
            sub={isAllCities ? "Live stadium tours & acoustic sets across India" : `Live stadium tours & concerts in ${city}`}
            link={<Link to="/events?cat=music" className="link-btn">View all →</Link>}
          >
            {musicEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={handleBook} />
            ))}
          </Rail>
        )}

        {/* ── RAIL 4: SPORTS & CRICKET ── */}
        {(isAllCities || sportsEvents.length > 0) && (
          <Rail
            title={isAllCities ? "Sports & Cricket" : `Sports & Cricket in ${city}`}
            sub={isAllCities ? "Live matches, tournaments & stadium action" : `Live sports tournaments in ${city}`}
            link={<Link to="/events?cat=cricket" className="link-btn">View all →</Link>}
          >
            {sportsEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={handleBook} />
            ))}
          </Rail>
        )}

        {/* ── RAIL 5: DJ & NIGHTLIFE ── */}
        {(isAllCities || djEvents.length > 0) && (
          <Rail
            title={isAllCities ? "DJ & Nightlife" : `DJ & Nightlife in ${city}`}
            sub={isAllCities ? "Club nights, EDM festivals & beach sunsets" : `Club nights & EDM events in ${city}`}
            link={<Link to="/events?cat=dj" className="link-btn">View all →</Link>}
          >
            {djEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={handleBook} />
            ))}
          </Rail>
        )}

        {/* ── RAIL 6: FESTIVALS & COMEDY ── */}
        {(isAllCities || festivalEvents.length > 0) && (
          <Rail
            title={isAllCities ? "Festivals & Standup Comedy" : `Festivals & Comedy in ${city}`}
            sub={isAllCities ? "Cultural spectacles and laugh-out-loud specials" : `Live comedy & cultural festivals in ${city}`}
            link={<Link to="/events?cat=festival" className="link-btn">View all →</Link>}
          >
            {festivalEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={handleBook} />
            ))}
          </Rail>
        )}

        {/* ── RAIL 7: COMING SOON ── */}
        {(isAllCities || comingSoonEvents.length > 0) && (
          <Rail
            title={isAllCities ? "Coming Soon" : `Coming Soon in ${city}`}
            sub="Register early before tickets go live"
          >
            {comingSoonEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={handleBook} />
            ))}
          </Rail>
        )}
      </div>
    </main>
  );
}
