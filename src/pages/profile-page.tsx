import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { usePreferences, type ThemeMode } from "@/stores/preferences";

const themes: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "跟随系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
];

export function ProfilePage() {
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);

  return (
    <>
      <PageHeader title="我的" eyebrow="旅序" />
      <section className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">这台设备</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            旅序是单人行程本，没有账号。示例行程目前只存在于内存里，刷新后会回到最初的样子。
          </p>
        </div>
        <Separator />
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">外观</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="外观">
            {themes.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="lg"
                variant={theme === item.id ? "default" : "outline"}
                aria-pressed={theme === item.id}
                onClick={() => setTheme(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">关于</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            旅序 AI Travel。本地编排先行，云端、生成与地图都还没接入。
          </p>
        </div>
      </section>
    </>
  );
}
