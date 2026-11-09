import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components/page-header";
import { PlanScreen, type PlanForm, type PlanPhase } from "@/components/plan-screen";
import { UsageStats } from "@/components/usage-stats";
import { recordAiUsage } from "@/db/ai-usage";
import { db } from "@/db/database";
import { saveGeneratedDraft } from "@/db/repository";
import { fieldErrors } from "@/db/validation";
import { requestItinerary } from "@/lib/ai-client";
import { notifyError } from "@/lib/feedback";
import { preferenceSchema, splitInterests, type TravelDraft } from "@shared/ai-schema";

const initialForm: PlanForm = {
  destination: "",
  startDate: "",
  endDate: "",
  travelers: "2",
  budget: "medium",
  pace: "moderate",
  interests: "",
  notes: "",
  model: "deepseek-flash",
};

export function PlanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [phase, setPhase] = useState<PlanPhase>({ kind: "form", errors: {} });
  const [draft, setDraft] = useState<TravelDraft | null>(null);
  const [title, setTitle] = useState("");

  async function generate(retrying: boolean) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setPhase({
        kind: "network",
        message: "生成行程需要网络。已保存在这台设备上的行程仍可查看。",
      });
      return;
    }
    const parsed = preferenceSchema.safeParse({
      ...form,
      travelers: Number(form.travelers),
      interests: splitInterests(form.interests),
    });
    if (!parsed.success) {
      setPhase({ kind: "form", errors: fieldErrors(parsed.error) });
      return;
    }
    setPhase({ kind: retrying ? "retrying" : "generating" });
    const result = await requestItinerary(parsed.data);
    if (!result.ok) {
      setPhase({ kind: result.error, message: result.message });
      return;
    }
    setDraft(result.draft);
    setTitle(result.draft.title);
    try {
      await recordAiUsage(db, {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        destination: result.draft.destination,
        ...result.usage,
      });
      await queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
      await queryClient.invalidateQueries({ queryKey: ["ai-usage-remote"] });
    } catch {
      // The draft can still be saved if the local usage row is rejected.
    }
    setPhase({ kind: "preview", draft: result.draft, usage: result.usage });
  }

  async function save() {
    if (!draft || phase.kind !== "preview") return;
    const usage = phase.usage;
    const current = draft;
    setPhase({ kind: "saving" });
    try {
      const id = await saveGeneratedDraft(db, { ...current, title });
      navigate(`/trips/${id}`);
    } catch (error) {
      notifyError(error);
      setPhase({ kind: "preview", draft: current, usage });
    }
  }

  return (
    <>
      <PageHeader title="起草" eyebrow="旅序" backTo="/" />
      <section className="flex flex-col gap-6 px-4 py-6">
        <PlanScreen
          form={form}
          phase={phase}
          title={title}
          onForm={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onTitle={setTitle}
          onSubmit={() => void generate(false)}
          onRetry={() => void generate(phase.kind !== "form")}
          onDiscard={() => {
            setDraft(null);
            setPhase({ kind: "form", errors: {} });
          }}
          onSave={() => void save()}
        />
        <UsageStats />
      </section>
    </>
  );
}
