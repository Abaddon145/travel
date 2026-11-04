import { BedDouble, Lock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DayView, TimelineEntry } from "@/domain/types";
import { formatDateWithWeekday } from "@/lib/dates";

export function TripTimeline({ days }: { days: DayView[] }) {
  if (days.length === 0) {
    return null;
  }

  return (
    <ol className="flex flex-col gap-8">
      {days.map((day) => (
        <li key={day.id} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDateWithWeekday(day.date)}
            </p>
            <h2 className="text-base font-medium">{day.title}</h2>
            {day.note ? (
              <p className="text-sm text-muted-foreground">{day.note}</p>
            ) : null}
          </div>
          <ol className="flex flex-col gap-4 border-l border-border pl-4">
            {day.items.map((item) => (
              <TimelineRow key={item.id} item={item} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function TimelineRow({ item }: { item: TimelineEntry }) {
  const Icon = item.kind === "place" ? MapPin : BedDouble;
  return (
    <li className="relative flex flex-col gap-2">
      <span
        aria-hidden="true"
        className="absolute top-2 -left-[1.3rem] size-2 rounded-full bg-primary"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground tabular-nums">
          {item.timeLabel}
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
        <p className="text-base font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {item.area}
          {item.note ? ` · ${item.note}` : ""}
        </p>
      </div>
    </li>
  );
}
