import { DurableObject } from "cloudflare:workers";
import {
  addTokens,
  releaseRequest,
  reserveRequest,
  summarize,
  type Ledger,
} from "./quota";

const STORAGE_KEY = "ledger";

export type UsageSnapshot = {
  today: { requests: number; tokens: number };
  month: { requests: number; tokens: number };
};

export class AiUsageLedger extends DurableObject<Env> {
  private async load() {
    return (await this.ctx.storage.get<Ledger>(STORAGE_KEY)) ?? {};
  }

  private async save(ledger: Ledger) {
    await this.ctx.storage.put(STORAGE_KEY, ledger);
  }

  async reserve(input: { today: string; requestCap: number; tokenCap: number }) {
    const result = reserveRequest(await this.load(), input.today, {
      requests: input.requestCap,
      tokens: input.tokenCap,
    });
    await this.save(result.ledger);
    return { ok: result.ok, ...result.summary };
  }

  async commit(input: { today: string; tokens: number }): Promise<UsageSnapshot> {
    const next = addTokens(await this.load(), input.today, input.tokens);
    await this.save(next);
    return summarize(next, input.today);
  }

  async release(input: { today: string }): Promise<UsageSnapshot> {
    const next = releaseRequest(await this.load(), input.today);
    await this.save(next);
    return summarize(next, input.today);
  }

  async summary(input: { today: string }): Promise<UsageSnapshot> {
    const ledger = await this.load();
    return summarize(ledger, input.today);
  }
}
