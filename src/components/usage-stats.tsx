import { useQuery } from "@tanstack/react-query";
import { readAiUsageStats } from "@/db/ai-usage";
import { db } from "@/db/database";
import { formatUsd } from "@/lib/ai-cost";
import { readServerUsage } from "@/lib/ai-client";

export function UsageStats() {
  const local = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => readAiUsageStats(db),
  });
  const remote = useQuery({
    queryKey: ["ai-usage-remote"],
    queryFn: readServerUsage,
    retry: false,
  });
  const stats = local.data;
  const cap = remote.data?.caps.dailyRequests ?? 30;
  const used = remote.data?.today.requests ?? stats?.todayCalls ?? 0;
  const width = `${Math.max(0, Math.min(1, cap === 0 ? 0 : used / cap)) * 100}%`;
  return (
    <section className="flex flex-col gap-3" aria-label="用量">
      <h2 className="text-sm font-medium">额度</h2>
      {stats || remote.data ? (
        <>
          <p className="text-sm">今日 {used}/{cap}</p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="今日用量"
            aria-valuemin={0}
            aria-valuemax={cap}
            aria-valuenow={Math.min(used, cap)}
          >
            <div className="h-full bg-primary" style={{ width }} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">正在读取用量。</p>
      )}
      <details className="rounded-lg border">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm">
          用量细节
        </summary>
        <p className="px-3 pb-3 text-sm leading-6 text-pretty text-muted-foreground">
          {stats
            ? `本机今日 ${stats.todayCalls} 次、${stats.todayTokens} 个令牌。本月 ${stats.monthCalls} 次、${stats.monthTokens} 个令牌。按美元估算 ${formatUsd(stats.monthUsd)}（官方闲时标价，高峰约为两倍）。`
            : "本机用量还没读到。"}
          {remote.data
            ? ` 服务端今日 ${remote.data.today.requests}/${remote.data.caps.dailyRequests} 次，令牌 ${remote.data.today.tokens}/${remote.data.caps.dailyTokens}。`
            : " 验证密钥后可以看到服务端今日次数。"}
        </p>
      </details>
    </section>
  );
}
