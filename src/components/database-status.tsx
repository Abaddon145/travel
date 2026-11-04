import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function DatabaseStatus({
  kind,
  onRetry,
}: {
  kind: "loading" | "error" | "unavailable";
  onRetry?: () => void;
}) {
  if (kind === "loading") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 pt-safe-4 pb-safe-4">
        <p className="sr-only">正在读取行程</p>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </main>
    );
  }

  const unavailable = kind === "unavailable";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 pt-safe-4 pb-safe-4">
      <Alert variant={unavailable ? "default" : "destructive"}>
        <AlertTitle>{unavailable ? "无法使用本地数据库" : "行程暂时读不出来"}</AlertTitle>
        <AlertDescription>
          {unavailable
            ? "此浏览器没有可用的 IndexedDB。旅序需要它把行程留在这台设备上。请换用系统浏览器，或退出无痕模式后再试。"
            : "打开本地行程库时出错。数据应该还在这台设备上，可以重试。"}
        </AlertDescription>
      </Alert>
      {onRetry ? (
        <Button type="button" onClick={onRetry}>
          重试
        </Button>
      ) : null}
    </main>
  );
}
