import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { BedDouble, Lock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DayView, TimelineEntry } from "@/domain/types";
import { dragReorder, swipeDelete } from "@/lib/gestures";
import { tapFeedback } from "@/lib/haptics";
import { formatDateWithWeekday } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function TripTimeline({
  days,
  renderDayActions,
  renderDayFooter,
  onReorder,
  onOpen,
  onDelete,
  selectedId,
  onSelect,
}: {
  days: DayView[];
  renderDayActions?: (day: DayView) => ReactNode;
  renderDayFooter?: (day: DayView) => ReactNode;
  onReorder?: (item: TimelineEntry, direction: "up" | "down") => void;
  onOpen?: (item: TimelineEntry) => void;
  onDelete?: (item: TimelineEntry) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (days.length === 0) {
    return null;
  }

  return (
    <ol className="flex flex-col gap-8">
      {days.map((day) => (
        <li key={day.id} className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatDateWithWeekday(day.date)}
              </p>
              <h2 className="text-base font-medium">{day.title}</h2>
              {day.note ? (
                <p className="text-sm text-muted-foreground">{day.note}</p>
              ) : null}
              {day.locked ? (
                <p className="text-xs text-muted-foreground">全天已锁定</p>
              ) : null}
              {!day.locked && day.lockedFrom && day.lockedTo ? (
                <p className="text-xs text-muted-foreground">
                  {day.lockedFrom}–{day.lockedTo} 已锁定
                </p>
              ) : null}
            </div>
            {renderDayActions ? (
              <div className="flex shrink-0 gap-1">{renderDayActions(day)}</div>
            ) : null}
          </div>
          {renderDayFooter ? renderDayFooter(day) : null}
          <ol className="flex flex-col gap-4 border-l border-border pl-4">
            {day.items.map((item) => (
              <TimelineRow
                key={item.id}
                item={item}
                onReorder={onReorder}
                onOpen={onOpen}
                onDelete={onDelete}
                selected={selectedId === item.id}
                onSelect={onSelect}
              />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function TimelineRow({
  item,
  onReorder,
  onOpen,
  onDelete,
  selected,
  onSelect,
}: {
  item: TimelineEntry;
  onReorder?: (item: TimelineEntry, direction: "up" | "down") => void;
  onOpen?: (item: TimelineEntry) => void;
  onDelete?: (item: TimelineEntry) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const Icon = item.kind === "place" ? MapPin : BedDouble;
  const start = useRef<{ x: number; y: number; dragging: boolean; moved: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const suppress = useRef(false);
  const timer = useRef<number | null>(null);

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function down(event: PointerEvent<HTMLLIElement>) {
    if (item.locked || event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, dragging: false, moved: 0 };
    clearTimer();
    timer.current = window.setTimeout(() => {
      if (!start.current || !onReorder) return;
      start.current.dragging = true;
      tapFeedback();
    }, 450);
  }

  function move(event: PointerEvent<HTMLLIElement>) {
    const origin = start.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!origin.dragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) clearTimer();
    if (origin.dragging && onReorder) {
      const direction = dragReorder(dy - origin.moved);
      if (direction) {
        origin.moved += direction === "up" ? -36 : 36;
        origin.y = event.clientY;
        origin.moved = 0;
        onReorder(item, direction);
      }
      return;
    }
    if (dx < -8 && Math.abs(dx) > Math.abs(dy)) setOffset(Math.max(dx, -96));
  }

  function up(event: PointerEvent<HTMLLIElement>) {
    const origin = start.current;
    clearTimer();
    start.current = null;
    setOffset(0);
    if (!origin) return;
    if (origin.dragging) {
      suppress.current = true;
      return;
    }
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (onDelete && swipeDelete(dx, dy)) {
      suppress.current = true;
      tapFeedback();
      onDelete(item);
    }
  }

  return (
    <li
      className={cn(
        "relative flex flex-col gap-2 rounded-lg px-2 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "bg-primary/10",
      )}
      data-testid="timeline-item"
      tabIndex={onReorder ? 0 : undefined}
      aria-keyshortcuts={onReorder ? "ArrowUp ArrowDown" : undefined}
      style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(event) => {
        if (!onReorder) return;
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        onReorder(item, event.key === "ArrowUp" ? "up" : "down");
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-4 -left-[1.3rem] size-2 rounded-full bg-primary"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground tabular-nums">
          {item.timeLabel || "未定时"}
        </span>
        <Badge variant={item.kind === "place" ? "secondary" : "outline"}>
          <Icon aria-hidden="true" data-icon="inline-start" />
          {item.kind === "place" ? "景点" : "住宿"}
        </Badge>
        {item.locked ? (
          <Badge variant="outline">
            <Lock aria-hidden="true" data-icon="inline-start" />
            已锁定
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        {onSelect || onOpen ? (
          <button
            type="button"
            id={`timeline-${item.id}`}
            data-testid="timeline-name"
            className="flex min-h-11 items-center rounded-sm text-left text-base font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-current={selected ? "true" : undefined}
            onClick={() => {
              if (suppress.current) {
                suppress.current = false;
                return;
              }
              onSelect?.(item.id);
              onOpen?.(item);
            }}
          >
            {item.name}
          </button>
        ) : (
          <p className="text-base font-medium" data-testid="timeline-name">
            {item.name}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {item.area}
          {item.note ? ` · ${item.note}` : ""}
        </p>
      </div>
    </li>
  );
}
