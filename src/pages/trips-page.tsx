import { PageHeader } from "@/components/page-header";

export function TripsPage() {
  return (
    <>
      <PageHeader title="行程" eyebrow="旅序" />
      <section className="px-4 py-6">
        <p className="text-sm leading-6 text-muted-foreground">
          行程列表会显示在这里。
        </p>
      </section>
    </>
  );
}
