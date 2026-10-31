import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop component
 * Automatically resets window scroll position to (0, 0) whenever the route path or search changes.
 * Disables CSS smooth scrolling temporarily to ensure the viewport snaps cleanly to the top.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  const resetScroll = () => {
    // 1. Temporarily disable smooth scroll so the jump to top is instant
    const root = document.documentElement;
    const prevScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    // 2. Reset scroll position on window, documentElement, and body
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    root.scrollTop = 0;
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // 3. Restore original scroll behavior after frame
    requestAnimationFrame(() => {
      root.style.scrollBehavior = prevScrollBehavior;
    });
  };

  useLayoutEffect(() => {
    resetScroll();
  }, [pathname, search]);

  useEffect(() => {
    resetScroll();
    // Re-verify after paint in case child components or images mount asynchronously
    const rafId = requestAnimationFrame(() => {
      resetScroll();
    });
    const timeoutId = setTimeout(() => {
      resetScroll();
    }, 60);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [pathname, search]);

  return null;
}
