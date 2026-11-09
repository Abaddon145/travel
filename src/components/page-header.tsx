import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 px-4 pt-safe backdrop-blur-md">
      <div className="flex min-h-14 items-center gap-2 py-3">
        {backTo ? (
          <Button variant="ghost" size="icon" asChild>
            <Link to={backTo} aria-label="返回">
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
