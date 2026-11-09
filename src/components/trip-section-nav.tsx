import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

const sections = [
  { to: (tripId: string) => `/trips/${tripId}`, label: "日程", end: true },
  { to: (tripId: string) => `/trips/${tripId}/budget`, label: "预算", end: false },
  { to: (tripId: string) => `/trips/${tripId}/bookings`, label: "预订", end: false },
  { to: (tripId: string) => `/trips/${tripId}/kit`, label: "清单", end: false },
] as const;

export function TripSectionNav({ tripId }: { tripId: string }) {
  return (
    <nav aria-label="这趟行程" className="-mx-1 flex gap-1 overflow-x-auto pb-3">
      {sections.map((section) => (
        <NavLink
          key={section.label}
          to={section.to(tripId)}
          end={section.end}
          className={({ isActive }) =>
            cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm",
              isActive ? "bg-foreground text-background" : "text-muted-foreground",
            )
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
