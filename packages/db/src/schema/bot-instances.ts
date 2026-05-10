import { BOT_DESIRED_STATES, BOT_STATUSES } from '@weclaws/shared';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { userLlmProfiles } from './user-llm-profiles';
import { workspaces } from './workspaces';

export const botInstances = sqliteTable(
  'bot_instances',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    llmConfigId: text('llm_config_id')
      .references(() => userLlmProfiles.id),
    desiredState: text('desired_state', { enum: BOT_DESIRED_STATES }).notNull(),
    status: text('status', { enum: BOT_STATUSES }).notNull(),
    processPid: integer('process_pid'),
    processStartedAt: integer('process_started_at', { mode: 'timestamp_ms' }),
    heartbeatAt: integer('heartbeat_at', { mode: 'timestamp_ms' }),
    restartCount: integer('restart_count').notNull().default(0),
    restartBackoffUntil: integer('restart_backoff_until', { mode: 'timestamp_ms' }),
    restartRequestedAt: integer('restart_requested_at', { mode: 'timestamp_ms' }),
    qrReissueRequestedAt: integer('qr_reissue_requested_at', { mode: 'timestamp_ms' }),
    lastQrCodeId: text('last_qr_code_id'),
    lastQrCodeUrl: text('last_qr_code_url'),
    weixinAccountId: text('weixin_account_id'),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    ownerUserIndex: index('bot_instances_owner_user_idx').on(table.ownerUserId),
    desiredStateStatusIndex: index('bot_instances_desired_state_status_idx').on(
      table.desiredState,
      table.status,
    ),
    restartBackoffIndex: index('bot_instances_restart_backoff_idx').on(table.restartBackoffUntil),
  }),
);
