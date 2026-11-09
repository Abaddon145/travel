import { motion } from "motion/react";
import { useOnline } from "@/lib/online";
import { useQuietMotion } from "@/hooks/use-quiet-motion";

export function OfflineBanner() {
  const online = useOnline();
  const quiet = useQuietMotion();
  if (online) return null;
  return (
    <motion.p
      role="status"
      data-testid="offline-banner"
      className="no-print border-b bg-secondary px-4 py-3 text-sm leading-6"
      initial={quiet ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: quiet ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      当前离线。已保存在这台设备上的行程仍可查看。生成、助手、地图和云端接口需要网络。
    </motion.p>
  );
}
