import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiStatusCard } from "@/components/api-status-card";
import { OwnerKeySection } from "@/components/owner-key-section";
import { UsageStats } from "@/components/usage-stats";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { readPersistentStorage, requestPersistentStorage } from "@/db/persistence";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/feedback";
import { usePreferences, type ThemeMode } from "@/stores/preferences";

const themes: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "跟随系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
];

export function ProfilePage() {
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);
  const queryClient = useQueryClient();
  const persisted = useQuery({
    queryKey: ["storage-persisted"],
    queryFn: readPersistentStorage,
  });
  const request = useMutation({
    mutationFn: requestPersistentStorage,
    onSuccess: async (allowed) => {
      await queryClient.invalidateQueries({ queryKey: ["storage-persisted"] });
      if (allowed) notifySuccess("浏览器已允许持久保存");
      else toast.error("浏览器还没有允许持久保存。");
    },
    onError: () => toast.error("没有完成持久化请求，请再试一次。"),
  });

  const storageText =
    persisted.data === true
      ? "浏览器已允许持久保存。除非你亲自清除站点数据，否则刷新或重启后行程还在。"
      : persisted.data === false
        ? "浏览器还没保证持久保存。存储空间紧张时，系统可能会清掉离线数据。"
        : "当前环境没有提供持久化存储接口。";

  return (
    <>
      <PageHeader title="我的" eyebrow="旅序" />
      <section className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">这台设备</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            旅序是单人行程本，没有账号。行程写在这台设备的 IndexedDB 里。
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{storageText}</p>
          <Button
            type="button"
            variant="outline"
            disabled={persisted.data === true || request.isPending}
            onClick={() => request.mutate()}
          >
            允许持久保存
          </Button>
        </div>
        <Separator />
        <OwnerKeySection />
        <Separator />
        <UsageStats />
        <Separator />
        <ApiStatusCard />
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
            旅序 AI
            Travel。行程仍在这台设备上。可以在行程页生成多日草稿。地图还没有接入。
          </p>
        </div>
      </section>
    </>
  );
}
