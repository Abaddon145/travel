import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function MissingState({
  icon,
  title,
  description,
  action = "回到行程",
  to = "/",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: string;
  to?: string;
}) {
  return (
    <Empty className="border-border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <Button className="h-11" asChild>
        <Link to={to}>{action}</Link>
      </Button>
    </Empty>
  );
}
