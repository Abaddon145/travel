import { CalendarDays, CircleUser, Compass } from "lucide-react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "行程", icon: CalendarDays, end: true },
  { to: "/explore", label: "探索", icon: Compass, end: false },
  { to: "/profile", label: "我的", icon: CircleUser, end: false },
] as const;

export function TabBar() {
  return (
    <nav
      aria-label="主导航"
      className="border-t bg-background/90 pb-safe backdrop-blur-md"
    >
      <div className="mx-auto grid max-w-lg grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 text-xs [&_svg]:size-5",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon aria-hidden="true" />
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
