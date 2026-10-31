import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2400);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div
      className="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      {/* Stage lights / beams */}
      <div className="splash-beams">
        <i style={{ transform: "rotate(-25deg)" }} />
        <i style={{ transform: "rotate(25deg)" }} />
        <i style={{ transform: "rotate(0deg)" }} />
      </div>

      {/* Moving filmstrips */}
      <div className="filmstrip top">
        {[...Array(35)].map((_, i) => (
          <b key={i} />
        ))}
      </div>

      {/* Center content */}
      <div className="splash-center">
        <motion.div
          className="splash-reel"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--red)" }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          show<span>time</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, letterSpacing: "2px" }}
          animate={{ opacity: 1, letterSpacing: "6px" }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          EVENTS · TICKETS · EXPERIENCES
        </motion.p>

        {/* Animated loading bar */}
        <motion.div
          className="splash-bar"
          initial={{ width: 0 }}
          animate={{ width: 160 }}
          transition={{ delay: 0.4, duration: 1.6, ease: "easeInOut" }}
        />
      </div>

      <div className="filmstrip bottom">
        {[...Array(35)].map((_, i) => (
          <b key={i} />
        ))}
      </div>
    </motion.div>
  );
}

