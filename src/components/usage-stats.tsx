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
  return (
    <section className="flex flex-col gap-2" aria-label="用量">
      <h2 className="text-sm font-medium">额度</h2>
      <p className="text-sm leading-6 break-words text-pretty text-muted-foreground">
        {stats
          ? `今日 ${stats.todayCalls} 次、${stats.todayTokens} 个令牌。本月 ${stats.monthCalls} 次、${stats.monthTokens} 个令牌。按美元估算 ${formatUsd(stats.monthUsd)}（官方闲时标价，高峰约为两倍）。`
          : "正在读取本机用量。"}
        {remote.data
          ? ` 服务端今日 ${remote.data.today.requests}/${remote.data.caps.dailyRequests} 次。`
          : ""}
      </p>
    </section>
  );
}
