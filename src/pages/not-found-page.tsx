import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="找不到这一页" eyebrow="旅序" />
      <section className="flex flex-col items-start gap-4 px-4 py-6">
        <p className="text-sm leading-6 text-muted-foreground">
          这个地址没有对应的行程。
        </p>
        <Button asChild>
          <Link to="/">回到行程</Link>
        </Button>
      </section>
    </>
  );
}
