import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getEventById as localGetEventById, events as allLocalEvents } from "../data/events";
import { getEventById as apiGetEventById, getEvents } from "../services/api";
import EventCard, { EventPoster } from "../components/EventCard";

const CATEGORY_LIGHT_GRADIENTS = {
  music: "linear-gradient(135deg, #ffffff 0%, #faf5ff 45%, #f3e8ff 100%)",
  cricket: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 45%, #dcfce7 100%)",
  sports: "linear-gradient(135deg, #ffffff 0%, #eff6ff 45%, #dbeafe 100%)",
  dj: "linear-gradient(135deg, #ffffff 0%, #faf5ff 45%, #ede9fe 100%)",
  festival: "linear-gradient(135deg, #ffffff 0%, #fffbeb 45%, #fef3c7 100%)",
  comedy: "linear-gradient(135deg, #ffffff 0%, #fff7ed 45%, #ffedd5 100%)",
};

const SAMPLE_REVIEWS = [
  { name: "Aarav Sharma", rating: 5, time: "2 days ago", comment: "Unbelievable production quality and electric atmosphere! Definitely worth every rupee." },
  { name: "Pooja Mehta", rating: 5, time: "1 week ago", comment: "The sound system and crowd management were top notch. E-ticket entry was super smooth." },
  { name: "Rohan Varma", rating: 4, time: "2 weeks ago", comment: "Great line-up, high energy performances throughout! Highly recommend attending." },
];

function DetailRail({ title, sub, children }) {
  const rowRef = useRef(null);
  const scroll = (dir) => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: dir * 640, behavior: "smooth" });
    }
  };

  return (
    <section className="rail" style={{ marginTop: 40 }}>
      <div className="rail-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
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

export default function EventDetail({ user, setShowLogin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(() => localGetEventById(id));
  const [allEvents, setAllEvents] = useState(allLocalEvents);
  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    apiGetEventById(id).then((data) => {
      if (data) setEvent(data);
    });
    getEvents().then((data) => {
      if (data && data.length) setAllEvents(data);
    });
  }, [id]);

  if (!event) {
    return (
      <div className="wrap pad center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div>
          <h2>Event Not Found</h2>
          <p className="muted" style={{ margin: "10px 0 20px" }}>The event you are looking for does not exist or has ended.</p>
          <Link to="/" className="btn-primary">← Explore Other Events</Link>
        </div>
      </div>
    );
  }

  const dateStr = new Date(event.date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleBook = () => {
    // When user tries to book, if not logged in, trigger login popup!
    if (!user) {
      if (setShowLogin) setShowLogin(true);
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    navigate(`/seats/${event.id}`);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const bgGrad = CATEGORY_LIGHT_GRADIENTS[event.category] || CATEGORY_LIGHT_GRADIENTS.music;

  const sameCityEvents = allEvents.filter(
    (e) => e.id !== event.id && (e.city === event.city || e.category === event.category)
  );

  const otherPopularEvents = allEvents.filter(
    (e) => e.id !== event.id && !sameCityEvents.some((sc) => sc.id === e.id)
  );

  return (
    <main style={{ paddingBottom: 60 }}>
      {/* ── UNIFORM LIGHT THEME EVENT BANNER ── */}
      <section className="mv-banner" style={{ background: bgGrad }}>
        <div className="wrap mv-in">
          {/* Poster Visual */}
          <motion.div
            className="mv-poster"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <EventPoster event={event} />
            <div className="mv-poster-foot">
              {event.filledPct > 0.85 ? "HIGH DEMAND" : "INSTANT E-TICKET"}
            </div>
          </motion.div>

          {/* Event Details */}
          <div className="mv-info">
            <Link to="/" className="mv-back" id="back-to-events-link">
              ← Back to all events
            </Link>

            <motion.h1
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {event.title}
            </motion.h1>

            {event.subtitle && (
              <p className="mv-sub">{event.subtitle}</p>
            )}

            <div className="mv-rate">
              <span style={{ color: "var(--ink2)" }}>{event.rating} / 5</span>
              <em>({event.votes.toLocaleString()} verified ratings)</em>
            </div>

            <div className="mv-fmt">
              <b>{event.category.toUpperCase()}</b>
              {event.tags?.map((t) => (
                <b key={t}>{t}</b>
              ))}
            </div>

            <div className="mv-meta">
              <span>Date: <strong>{dateStr}</strong></span>
              <span>Time: <strong>{event.time} · {event.duration}</strong></span>
              <span>Venue: <strong>{event.venue}, {event.city}</strong></span>
            </div>

            <div className="mv-price">
              Starting from <strong>₹{event.price.toLocaleString()}</strong> / ticket
            </div>

            <div className="mv-actions">
              <button
                className="btn-primary big"
                onClick={handleBook}
                id="book-tickets-btn"
              >
                Book Tickets
              </button>
              <button
                className="btn-secondary"
                onClick={handleShare}
                id="share-event-btn"
              >
                {copied ? "Link Copied" : "Share Event"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── EVENT BODY CONTENT ── */}
      <div className="wrap mv-body">
        {/* About */}
        <h2>About This Event</h2>
        <p className="syn">
          {descExpanded
            ? event.description
            : event.description.slice(0, 240) + (event.description.length > 240 ? "…" : "")}
        </p>
        {event.description.length > 240 && (
          <button
            className="link-btn"
            onClick={() => setDescExpanded(!descExpanded)}
            style={{ marginTop: 8, cursor: "pointer", display: "inline-block" }}
          >
            {descExpanded ? "Show less" : "Read more →"}
          </button>
        )}

        <hr />

        {/* Cast / Lineup */}
        {event.cast && event.cast.length > 0 && (
          <>
            <h2>Artist & Performers</h2>
            <div className="cast">
              {event.cast.map((c, i) => (
                <div key={i}>
                  <div
                    className="cast-av"
                    style={{
                      background: `linear-gradient(135deg, hsl(${i * 65 + 240}, 70%, 55%), hsl(${i * 65 + 280}, 80%, 40%))`,
                    }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <b>{c.name}</b>
                  <small>{c.role}</small>
                </div>
              ))}
            </div>
            <hr />
          </>
        )}

        {/* Guidelines without emojis */}
        <h2>Important Guidelines</h2>
        <div className="guide-grid">
          <div className="guide-card">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>PASS</span>
            <div>
              <b>Contactless Entry</b>
              <small>Show mobile QR code at gates</small>
            </div>
          </div>
          <div className="guide-card">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>ID</span>
            <div>
              <b>Age & ID Requirement</b>
              <small>Government ID required for 16+</small>
            </div>
          </div>
          <div className="guide-card">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>BAG</span>
            <div>
              <b>Prohibited Items</b>
              <small>No outside food, bottles or bags</small>
            </div>
          </div>
          <div className="guide-card">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>REF</span>
            <div>
              <b>Easy Cancellation</b>
              <small>Refund up to 48 hrs before show</small>
            </div>
          </div>
        </div>

        <hr />

        {/* Reviews */}
        <h2>Verified Reviews</h2>
        <div className="reviews">
          {SAMPLE_REVIEWS.map((r, i) => (
            <div key={i} className="review">
              <div className="rv-top">
                <strong>{r.name}</strong>
                <em style={{ color: "var(--red)", fontWeight: 700 }}>{r.rating} / 5</em>
              </div>
              <p>"{r.comment}"</p>
              <small>{r.time}</small>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        {sameCityEvents.length > 0 && (
          <DetailRail
            title={`More Events in ${event.city}`}
            sub="Popular live experiences you might enjoy"
          >
            {sameCityEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                onClick={(e) => navigate(`/event/${e.id}`)}
              />
            ))}
          </DetailRail>
        )}

        {otherPopularEvents.length > 0 && (
          <DetailRail
            title="Trending Across India"
            sub="Top-rated experiences you should not miss"
          >
            {otherPopularEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                onClick={(e) => navigate(`/event/${e.id}`)}
              />
            ))}
          </DetailRail>
        )}
      </div>
    </main>
  );
}
