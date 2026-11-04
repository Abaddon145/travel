import { Button } from "@/components/ui/button";
import { AppProviders } from "@/providers/app-providers";
import { usePreferences, type ThemeMode } from "@/stores/preferences";

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "跟随系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
];

function DesignMark() {
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-safe pt-safe-4 pb-safe-4">
      <div className="flex flex-1 flex-col justify-end gap-8 px-4 pb-8">
        <p className="text-sm text-muted-foreground">个人行程</p>
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-medium tracking-tight">旅序</h1>
          <p className="max-w-sm text-base leading-7 text-muted-foreground">
            把一天里的景点与住宿，按你的节奏排好。数据只留在这台设备上。
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="外观">
          {THEMES.map((item) => (
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
    </main>
  );
}

export default function App() {
  return (
    <AppProviders>
      <DesignMark />
    </AppProviders>
  );
}
