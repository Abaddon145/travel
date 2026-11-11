import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { swipeDelete } from "@/lib/gestures";
import { tapFeedback } from "@/lib/haptics";
import { useQuietMotion } from "@/hooks/use-quiet-motion";
import { cn } from "@/lib/utils";

export function SwipeRow({
  children,
  onDelete,
  disabled = false,
}: {
  children: ReactNode;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  const quiet = useQuietMotion();
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !onDelete || event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, active: true };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin?.active) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (dx < 0 && Math.abs(dx) > Math.abs(dy)) setOffset(Math.max(dx, -96));
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    start.current = null;
    if (!origin?.active || !onDelete) {
      setOffset(0);
      return;
    }
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (swipeDelete(dx, dy)) {
      tapFeedback();
      onDelete();
    }
    setOffset(0);
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-destructive/15 text-sm text-destructive"
      >
        删除
      </div>
      <div
        className={cn("relative bg-background", quiet ? "" : "transition-transform")}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {children}
      </div>
    </div>
  );
}
