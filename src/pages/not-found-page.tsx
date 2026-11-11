import { Compass } from "lucide-react";
import { MissingState } from "@/components/missing-state";
import { PageHeader } from "@/components/page-header";

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="找不到这一页" eyebrow="旅序" />
      <section className="px-4 py-10">
        <MissingState
          icon={<Compass />}
          title="这个地址没有页面"
          description="链接可能旧了。回到行程列表，从那里继续。"
        />
      </section>
    </>
  );
}
