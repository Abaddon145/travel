import { OwnerKeyForm } from "@/components/owner-key-form";

export function OwnerKeySection() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">私人密钥</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        只写在这台设备上，用来打开付费和管理接口。不会同步到别处。
      </p>
      <OwnerKeyForm />
    </div>
  );
}
