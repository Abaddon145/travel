import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useQuietMotion } from "@/hooks/use-quiet-motion";
import {
  applyPwaUpdate,
  dismissPwaRefresh,
  ensurePwa,
  getPwaSnapshot,
  getServerPwaSnapshot,
  subscribePwa,
} from "@/pwa/register";

export function UpdatePrompt() {
  const quiet = useQuietMotion();
  const [params] = useSearchParams();
  const preview = params.get("sw-update") === "1";
  const pwa = useSyncExternalStore(subscribePwa, getPwaSnapshot, getServerPwaSnapshot);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    ensurePwa();
  }, []);

  if (hidden || (!pwa.needRefresh && !preview)) return null;

  return (
    <motion.div
      role="region"
      aria-label="版本更新"
      data-testid="update-prompt"
      className="no-print border-t bg-card px-4 py-3"
      initial={quiet ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: quiet ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-sm leading-6">
        有新版本可用。刷新后才会换成新的外壳，当前这次操作不会被打断。
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => {
            dismissPwaRefresh();
            setHidden(true);
          }}
        >
          稍后
        </Button>
        <Button
          type="button"
          className="h-11 flex-1"
          onClick={() => {
            void applyPwaUpdate().finally(() => {
              if (preview) window.location.reload();
            });
          }}
        >
          刷新
        </Button>
      </div>
    </motion.div>
  );
}
