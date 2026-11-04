import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { readApiStatus, type ApiUiState } from "@/lib/api-status";
import { checkOwnerKey, readOwnerKey } from "@/lib/owner-key";

const copy: Record<ApiUiState["kind"], { title: string; body: string }> = {
  connected: {
    title: "已连接",
    body: "这台设备可以访问受保护的接口，也可以生成行程草稿。",
  },
  unauthorized: {
    title: "未授权",
    body: "当前访问没有通过门禁。付费接口不会被调用。",
  },
  unconfigured: {
    title: "尚未配置门禁",
    body: "生产环境还没有签发方或受众。在配好之前，付费接口保持关闭。",
  },
  rate_limited: {
    title: "请求过于频繁",
    body: "稍等再试。限制按身份或来源地址计算。",
  },
  error: {
    title: "接口暂时不可用",
    body: "没有连上同一源站的 /api。本地需要同时运行接口开发服务。",
  },
};

export function ApiStatusCard() {
  const reduce = useReducedMotion();
  const present = useQuery({
    queryKey: ["owner-key-present"],
    queryFn: () => readOwnerKey().length > 0,
    initialData: () => readOwnerKey().length > 0,
  });
  const verified = useQuery({
    queryKey: ["owner-key-check"],
    queryFn: () => checkOwnerKey(),
    enabled: present.data,
    retry: false,
  });
  const status = useQuery({
    queryKey: ["api-status"],
    queryFn: () => readApiStatus(),
    retry: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">云端接口</h2>
      {status.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <p className="sr-only">正在读取接口状态</p>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <StatusBody
          state={status.data ?? { kind: "error" }}
          verified={verified.data}
          reduce={Boolean(reduce)}
          onRetry={() => void status.refetch()}
        />
      )}
    </div>
  );
}

function describe(state: ApiUiState, verified?: string) {
  if (verified === "ok") {
    return {
      title: "已通过",
      body: "私人密钥已验证。可以在行程页生成多日草稿。",
    };
  }
  if (state.authMode === "owner-key" && state.kind === "unconfigured") {
    return {
      title: "尚未配置私人密钥",
      body: "生产环境还没有密钥指纹。在写入之前，付费接口保持关闭。",
    };
  }
  if (
    state.authMode === "owner-key" &&
    state.configured &&
    state.kind === "unauthorized"
  ) {
    return {
      title: "私人密钥已配置",
      body: "在下方验证这台设备。未通过之前，付费接口不会被调用。",
    };
  }
  if (state.authMode === "access" && state.kind === "unconfigured") {
    return copy.unconfigured;
  }
  return copy[state.kind];
}

function StatusBody({
  state,
  verified,
  reduce,
  onRetry,
}: {
  state: ApiUiState;
  verified?: string;
  reduce: boolean;
  onRetry: () => void;
}) {
  const text = describe(state, verified);
  const destructive = state.kind === "error" || state.kind === "unauthorized";
  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <Alert variant={destructive ? "destructive" : "default"}>
        <AlertTitle>{text.title}</AlertTitle>
        <AlertDescription>{text.body}</AlertDescription>
      </Alert>
      {state.kind === "error" || state.kind === "rate_limited" ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          重试
        </Button>
      ) : null}
    </motion.div>
  );
}
