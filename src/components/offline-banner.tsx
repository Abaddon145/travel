import { motion } from "motion/react";
import { useQuietMotion } from "@/hooks/use-quiet-motion";

export function OfflineBanner() {
  const quiet = useQuietMotion();
  return (
    <motion.p
      role="status"
      data-testid="offline-banner"
      className="pt-safe pb-1 text-sm leading-6"
      initial={quiet ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: quiet ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      离线中 · 行程可查看
      <span className="sr-only">生成、助手、地图和云端接口需要网络。</span>
    </motion.p>
  );
}
