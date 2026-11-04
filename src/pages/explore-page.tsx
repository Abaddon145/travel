import { PageHeader } from "@/components/page-header";

export function ExplorePage() {
  return (
    <>
      <PageHeader title="探索" eyebrow="旅序" />
      <section className="px-4 py-6">
        <p className="text-sm leading-6 text-muted-foreground">
          地点与灵感会显示在这里。
        </p>
      </section>
    </>
  );
}
