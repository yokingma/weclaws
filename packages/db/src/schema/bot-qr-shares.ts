import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { botInstances } from './bot-instances';

export const botQrShares = sqliteTable(
  'bot_qr_shares',
  {
    id: text('id').primaryKey(),
    botInstanceId: text('bot_instance_id')
      .notNull()
      .references(() => botInstances.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    tokenHash: text('token_hash').notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    botInstanceIdIndex: uniqueIndex('bot_qr_shares_bot_instance_id_idx').on(table.botInstanceId),
    tokenIndex: uniqueIndex('bot_qr_shares_token_idx').on(table.token),
    tokenHashIndex: uniqueIndex('bot_qr_shares_token_hash_idx').on(table.tokenHash),
    revokedAtIndex: index('bot_qr_shares_revoked_at_idx').on(table.revokedAt),
  }),
);
