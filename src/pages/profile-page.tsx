import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
      <section className="flex flex-col gap-4 px-4 py-6">
        <p className="text-sm leading-6 text-muted-foreground">
          旅序只服务你一个人。外观偏好保存在这台设备上。
        </p>
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
      </section>
    </>
  );
}
