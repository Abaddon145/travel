import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocation, useOutlet } from "react-router";

const ease = [0.22, 1, 0.36, 1] as const;

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, transform: "translateY(8px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        exit={
          reduce
            ? { opacity: 1, transform: "translateY(0px)" }
            : { opacity: 0, transform: "translateY(-6px)" }
        }
        transition={{ duration: reduce ? 0 : 0.22, ease }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
