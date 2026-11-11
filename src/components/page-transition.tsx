import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocation, useOutlet } from "react-router";

const ease = [0.22, 1, 0.36, 1] as const;

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();

  return (
    <div className="relative" data-app-scroll>
      <AnimatePresence initial={false}>
        <motion.div
          key={location.pathname}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={
            reduce
              ? { opacity: 1 }
              : { opacity: 0, position: "absolute", top: 0, left: 0, right: 0 }
          }
          transition={{ duration: reduce ? 0 : 0.15, ease }}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
