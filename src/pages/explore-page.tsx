import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const notes = [
  {
    title: "一天少排一点",
    body: "四个点已经很多。把余下的时间留给走路和吃饭。",
  },
  {
    title: "住宿靠近第二天",
    body: "行李少搬一次，早上出门就短。",
  },
  {
    title: "地图以后再接",
    body: "地点搜索与高德地图不在这一阶段。先把已有的行程排顺。",
  },
];

export function ExplorePage() {
  return (
    <>
      <PageHeader title="探索" eyebrow="旅序" />
      <section className="flex flex-col gap-4 px-4 py-6">
        <p className="text-sm leading-6 text-muted-foreground">
          这里先放几条编排时用得上的原则。搜索与地图会在后续阶段出现。
        </p>
        <ul className="flex flex-col gap-4">
          {notes.map((note) => (
            <li key={note.title}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{note.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{note.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
