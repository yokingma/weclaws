import { and, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { randomUUID } from 'node:crypto';
import { botQrShares } from '../schema/bot-qr-shares';
import type * as schema from '../schema/index';

type Db = BetterSQLite3Database<typeof schema>;

export interface BotQrShareRecord {
  id: string;
  botInstanceId: string;
  token: string;
  tokenHash: string;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertActiveBotQrShareInput {
  botInstanceId: string;
  createdAt?: Date;
  token: string;
  tokenHash: string;
}

export class BotQrShareRepository {
  constructor(private readonly db: Db) {}

  async upsertActiveByBotInstanceId(input: UpsertActiveBotQrShareInput) {
    const now = input.createdAt ?? new Date();

    this.db.insert(botQrShares)
      .values({
        botInstanceId: input.botInstanceId,
        createdAt: now,
        id: randomUUID(),
        revokedAt: null,
        token: input.token,
        tokenHash: input.tokenHash,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: botQrShares.botInstanceId,
        set: {
          revokedAt: null,
          token: input.token,
          tokenHash: input.tokenHash,
          updatedAt: now,
        },
      })
      .run();

    return this.findByBotInstanceId(input.botInstanceId);
  }

  async findByBotInstanceId(botInstanceId: string) {
    const row = this.db.select()
      .from(botQrShares)
      .where(eq(botQrShares.botInstanceId, botInstanceId))
      .get();

    return row ?? null;
  }

  async findActiveByBotInstanceId(botInstanceId: string) {
    const row = this.db.select()
      .from(botQrShares)
      .where(and(eq(botQrShares.botInstanceId, botInstanceId), isNull(botQrShares.revokedAt)))
      .get();

    return row ?? null;
  }

  async findActiveByTokenHash(tokenHash: string) {
    const row = this.db.select()
      .from(botQrShares)
      .where(and(eq(botQrShares.tokenHash, tokenHash), isNull(botQrShares.revokedAt)))
      .get();

    return row ?? null;
  }

  async revokeByBotInstanceId(botInstanceId: string, revokedAt: Date = new Date()) {
    const result = this.db.update(botQrShares)
      .set({
        revokedAt,
        updatedAt: revokedAt,
      })
      .where(and(eq(botQrShares.botInstanceId, botInstanceId), isNull(botQrShares.revokedAt)))
      .run();

    if (result.changes === 0) {
      return null;
    }

    return this.findByBotInstanceId(botInstanceId);
  }
}
