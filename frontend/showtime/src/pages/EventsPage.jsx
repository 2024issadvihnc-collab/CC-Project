import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { events as initialEvents, categories } from "../data/events";
import { getEvents } from "../services/api";
import EventCard from "../components/EventCard";

// Clean SVG icons for categories
const CATEGORY_ICONS = {
  all: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  music: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  cricket: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93c4.24 4.24 6.36 6.36 10.6 10.6" />
      <path d="m14.14 9.9 1.41-1.42" />
      <path d="m9.9 14.14-1.42 1.41" />
    </svg>
  ),
  sports: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  ),
  dj: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" />
    </svg>
  ),
  festival: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m2 22 10-20 10 20H2Z" />
      <path d="M12 2v20" />
    </svg>
  ),
  comedy: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
};

export default function EventsPage({ city: globalCity, setCity: setGlobalCity }) {
  const [params, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read URL query parameters
  const urlCat = params.get("cat") || "all";
  const urlQ = params.get("q") || "";

  const [allEvents, setAllEvents] = useState(initialEvents);
  const [cat, setCat] = useState(urlCat);
  const [q, setQ] = useState(urlQ);

  const currentCity = globalCity || "All Cities";
  const isAllCities = currentCity === "All" || currentCity === "All Cities";

  // Sync state when URL params change (e.g. user clicks category links in Navbar)
  useEffect(() => {
    const nextCat = params.get("cat") || "all";
    const nextQ = params.get("q") || "";
    setCat(nextCat);
    setQ(nextQ);
  }, [params]);

  // On browser refresh (F5/reload): immediately restore the full "All Events" explore page
  useEffect(() => {
    let isReload = false;
    try {
      const navEntries = performance.getEntriesByType("navigation");
      if (navEntries && navEntries.length > 0) {
        isReload = navEntries[0].type === "reload";
      } else if (performance.navigation) {
        isReload = performance.navigation.type === 1;
      }
    } catch (_) {}

    if (isReload) {
      setCat("all");
      setQ("");
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Fetch master list from backend once, keeping fallback
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    getEvents().then((data) => {
      if (data && Array.isArray(data) && data.length > 0) {
        setAllEvents(data);
      }
    });
  }, []);

  // Update category and synchronize URL
  function handleCategoryClick(categoryId) {
    setCat(categoryId);
    const next = new URLSearchParams(params);
    if (categoryId && categoryId !== "all") {
      next.set("cat", categoryId);
    } else {
      next.delete("cat");
    }
    setSearchParams(next, { replace: true });
  }

  // Clear search query
  function handleClearSearch() {
    setQ("");
    const next = new URLSearchParams(params);
    next.delete("q");
    setSearchParams(next, { replace: true });
  }

  // Reset all filters to default
  function handleResetAll() {
    setCat("all");
    setQ("");
    if (setGlobalCity) setGlobalCity("All Cities");
    setSearchParams({}, { replace: true });
  }

  const isAnyFilterActive = cat !== "all" || !isAllCities || Boolean(q);

  // Category pills should ONLY be visible in "All Events" (all) and "Live Events" (music)
  const showCategoryPills = cat === "all" || cat === "music";

  // Authoritative client-side filter over master event list, sorted by upcoming date
  const filtered = allEvents
    .filter((e) => {
      if (cat !== "all" && e.category?.toLowerCase() !== cat.toLowerCase()) return false;
      if (!isAllCities && e.city?.toLowerCase() !== currentCity.toLowerCase()) return false;
      if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        const matchTitle = e.title?.toLowerCase().includes(term);
        const matchVenue = e.venue?.toLowerCase().includes(term);
        const matchCity = e.city?.toLowerCase().includes(term);
        const matchSubtitle = e.subtitle?.toLowerCase().includes(term);
        if (!matchTitle && !matchVenue && !matchCity && !matchSubtitle) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <main className="wrap" style={{ paddingTop: 28, paddingBottom: 60 }}>
      {/* HEADER SECTION */}
      <div className="events-header">
        <h1 className="events-title">
          {cat !== "all"
            ? `${categories.find((c) => c.id === cat)?.label || "Category"} Events`
            : "All Events"}
        </h1>
        <div className="events-subtitle">
          <span>
            {filtered.length} {filtered.length === 1 ? "event" : "events"} found{" "}
            {!isAllCities ? `in ${currentCity}` : "across India"}
          </span>
          {isAnyFilterActive && (
            <span style={{ color: "var(--red, #f84464)", fontWeight: 600 }}>· Filtered</span>
          )}
        </div>

        {/* Active search badge if searched from Navbar */}
        {q && (
          <div className="active-search-badge" id="active-search-badge">
            <span>
              Search results for <strong>&ldquo;{q}&rdquo;</strong>
            </span>
            <button onClick={handleClearSearch} title="Clear search">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* CATEGORY FILTER PILLS (Only shown on "All Events" and "Live Events") */}
      {showCategoryPills && (
        <div className="events-cat-bar" id="events-cat-pills">
          {categories.map((c) => {
            const isActive = cat === c.id;
            return (
              <button
                key={c.id}
                className={`filter-pill${isActive ? " on" : ""}`}
                onClick={() => handleCategoryClick(c.id)}
                id={`filter-cat-${c.id}`}
                type="button"
              >
                {CATEGORY_ICONS[c.id] || CATEGORY_ICONS.all}
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* FILTER CONTROLS TOOLBAR (Reset Filter & Results Count - City is selected from top-right corner) */}
      <div className="events-controls-row">
        <div className="controls-left-group">
          {isAnyFilterActive && (
            <button
              className="btn-reset-filters"
              onClick={handleResetAll}
              id="btn-reset-all-filters"
              type="button"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset Filters
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="results-counter">
          Showing <strong>{filtered.length}</strong> of {allEvents.length} events
        </div>
      </div>

      {/* EVENT GRID */}
      {filtered.length === 0 ? (
        <div className="events-empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            style={{ margin: "0 auto 16px" }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <h3>No events match your filters</h3>
          <p>Try switching to another city or category to discover live experiences.</p>
          <button className="btn-primary" onClick={handleResetAll}>
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="mgrid">
          {filtered.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              onClick={(e) => navigate(`/event/${e.id}`)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
