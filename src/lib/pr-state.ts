import { DurableObject } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import {
  drizzle,
  type DrizzleSqliteDODatabase,
} from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../../drizzle/migrations";
import { prMessages } from "../db/schema";
import * as schema from "../db/schema";
import type { PrMessageRecord } from "../types";

interface Env {}

type PrMessageUpsertInput = Pick<
  typeof prMessages.$inferInsert,
  "prKey" | "slackTs" | "slackChannel" | "status" | "isDraft"
>;

export class PrState extends DurableObject<Env> {
  private readonly db: DrizzleSqliteDODatabase<typeof schema>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = drizzle(ctx.storage, { schema });
    ctx.blockConcurrencyWhile(() => migrate(this.db, migrations));
  }

  async getPrMessage(prKey: string): Promise<PrMessageRecord | null> {
    const record = await this.db
      .select()
      .from(prMessages)
      .where(eq(prMessages.prKey, prKey))
      .get();

    if (!record) {
      return null;
    }

    return {
      prKey: record.prKey,
      slackTs: record.slackTs,
      slackChannel: record.slackChannel,
      status: record.status,
      isDraft: record.isDraft,
      createdAt: Math.floor(record.createdAt.getTime() / 1000),
      updatedAt: Math.floor(record.updatedAt.getTime() / 1000),
    };
  }

  async upsertPrMessage(record: PrMessageUpsertInput): Promise<void> {
    await this.db
      .insert(prMessages)
      .values(record)
      .onConflictDoUpdate({
        target: prMessages.prKey,
        set: {
          slackTs: record.slackTs,
          slackChannel: record.slackChannel,
          status: record.status,
          isDraft: record.isDraft,
          updatedAt: new Date(),
        },
      });
  }

  async updatePrStatus(prKey: string, status: string): Promise<void> {
    await this.db
      .update(prMessages)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(prMessages.prKey, prKey));
  }
}
