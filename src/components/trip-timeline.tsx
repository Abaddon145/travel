import type { ReactNode } from "react";
import { BedDouble, Lock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DayView, TimelineEntry } from "@/domain/types";
import { formatDateWithWeekday } from "@/lib/dates";

export function TripTimeline({
  days,
  renderDayActions,
  renderDayFooter,
  renderItemActions,
  onReorder,
  selectedId,
  onSelect,
}: {
  days: DayView[];
  renderDayActions?: (day: DayView) => ReactNode;
  renderDayFooter?: (day: DayView) => ReactNode;
  renderItemActions?: (item: TimelineEntry) => ReactNode;
  onReorder?: (item: TimelineEntry, direction: "up" | "down") => void;
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
              {day.locked ? <p className="text-xs text-muted-foreground">全天已锁定</p> : null}
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
                actions={renderItemActions?.(item)}
                onReorder={onReorder}
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
  actions,
  onReorder,
  selected,
  onSelect,
}: {
  item: TimelineEntry;
  actions?: ReactNode;
  onReorder?: (item: TimelineEntry, direction: "up" | "down") => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const Icon = item.kind === "place" ? MapPin : BedDouble;
  return (
    <li
      className="relative flex flex-col gap-2"
      data-testid="timeline-item"
      tabIndex={onReorder ? 0 : undefined}
      aria-keyshortcuts={onReorder ? "ArrowUp ArrowDown" : undefined}
      onKeyDown={(event) => {
        if (!onReorder) return;
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        onReorder(item, event.key === "ArrowUp" ? "up" : "down");
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-2 -left-[1.3rem] size-2 rounded-full bg-primary"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground tabular-nums">
          {item.timeLabel || "未定时"}
        </span>
        <Badge variant={item.kind === "place" ? "secondary" : "outline"}>
          <Icon data-icon="inline-start" />
          {item.kind === "place" ? "景点" : "住宿"}
        </Badge>
        {item.locked ? (
          <Badge variant="outline">
            <Lock data-icon="inline-start" />
            已锁定
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        {onSelect ? (
          <button
            type="button"
            id={`timeline-${item.id}`}
            className={`text-left text-base font-medium ${selected ? "text-primary" : ""}`}
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(item.id)}
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
      {actions}
    </li>
  );
}
