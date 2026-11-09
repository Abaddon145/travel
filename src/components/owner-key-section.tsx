import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnline } from "@/lib/online";
import {
  checkOwnerKey,
  clearOwnerKey,
  readOwnerKey,
  saveOwnerKey,
  type OwnerKeyCheck,
} from "@/lib/owner-key";

type Phase = "idle" | "checking" | OwnerKeyCheck;

const labels: Record<Phase, string> = {
  idle: "未设置",
  checking: "验证中",
  ok: "已通过",
  invalid: "密钥无效",
  limited: "尝试过多",
  unconfigured: "门禁尚未配置",
  error: "网络错误",
};

export function OwnerKeySection() {
  const queryClient = useQueryClient();
  const online = useOnline();
  const [draft, setDraft] = useState(() => readOwnerKey());
  const [stored, setStored] = useState(() => readOwnerKey());
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  const status = phase === "idle" && stored ? "已保存在这台设备" : labels[phase];

  function publish(storedNow: boolean, check?: string) {
    queryClient.setQueryData(["owner-key-present"], storedNow);
    if (check) queryClient.setQueryData(["owner-key-check"], check);
    if (!storedNow) queryClient.removeQueries({ queryKey: ["owner-key-check"] });
  }

  async function verify() {
    setPhase("checking");
    const result = await checkOwnerKey();
    setPhase(result);
    publish(true, result);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">私人密钥</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        只写在这台设备上，用来打开付费和管理接口。不会同步到别处。
      </p>
      {online ? null : (
        <p className="text-sm leading-6 text-muted-foreground">
          验证私人密钥需要网络。密钥仍只写在这台设备上，不会因为离线被发出去。
        </p>
      )}
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="owner-key">
          私人密钥
        </label>
        <Input
          id="owner-key"
          className="h-11 text-base"
          type={visible ? "text" : "password"}
          name="lvxu-owner-key"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 px-3"
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "隐藏" : "显示"}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-sm font-medium">
        {status}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11"
          disabled={!draft.trim()}
          onClick={() => {
            const next = draft.trim();
            saveOwnerKey(next);
            setStored(next);
            setDraft(next);
            setPhase("idle");
            publish(true);
          }}
        >
          保存
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={!online || !stored || phase === "checking"}
          onClick={() => void verify()}
        >
          验证
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          onClick={() => {
            clearOwnerKey();
            setStored("");
            setDraft("");
            setPhase("idle");
            setVisible(false);
            publish(false);
          }}
        >
          清除
        </Button>
      </div>
    </div>
  );
}
