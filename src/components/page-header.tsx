import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { OfflineBanner } from "@/components/offline-banner";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/lib/online";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  eyebrow,
  backTo,
  action,
  footer,
}: {
  title: string;
  eyebrow?: string;
  backTo?: string;
  action?: ReactNode;
  footer?: ReactNode;
}) {
  const online = useOnline();
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const write = () => {
      document.documentElement.style.setProperty("--page-header-height", `${node.offsetHeight}px`);
    };
    write();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(write);
    observer.observe(node);
    return () => observer.disconnect();
  }, [online, title, eyebrow, footer]);

  return (
    <header
      ref={ref}
      data-page-header
      className={cn(
        "sticky top-0 z-20 border-b bg-background/85 px-4 backdrop-blur-md",
        online && "pt-safe",
      )}
    >
      {online ? null : <OfflineBanner />}
      <div className="flex min-h-14 items-center gap-2 py-3">
        {backTo ? (
          <Button variant="ghost" size="icon" asChild>
            <Link
              to={backTo}
              aria-label="返回"
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                const index = window.history.state?.idx;
                if (typeof index === "number" && index > 0) {
                  event.preventDefault();
                  void navigate(-1);
                }
              }}
            >
              <ChevronLeft aria-hidden="true" data-icon="inline-start" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-xs text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="truncate text-xl font-medium tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
      {footer}
    </header>
  );
}
