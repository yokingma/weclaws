'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BOT_STATUSES } from '@weclaws/shared';
import { EmptyState } from '@/components/layout/empty-state';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { getRuntimeStatusPresentation } from '@/lib/bot-status-presentation';
import type { BotCreationQuota, BotSummaryItem } from '@/lib/bot-service';
import { BotFilterBar } from './bot-filter-bar';
import { BotList } from './bot-list';
import { BotOverviewStats } from './bot-overview-stats';

interface BotsConsoleProps {
  bots: BotSummaryItem[];
  quota: BotCreationQuota;
}

type RuntimeFilterValue = 'all' | 'unknown' | (typeof BOT_STATUSES)[number];

export function BotsConsole({ bots, quota }: BotsConsoleProps) {
  const { locale, t } = useLocale();
  const [botItems, setBotItems] = useState(bots);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuntimeFilterValue>('all');
  const quotaSummary = quota.limit === null
    ? t((messages) => messages.botQuota.summaryUnlimited)({ usedCount: quota.usedCount })
    : t((messages) => messages.botQuota.summaryLimited)({
      limit: quota.limit,
      remainingCount: quota.remainingCount ?? 0,
      usedCount: quota.usedCount,
    });

  useEffect(() => {
    setBotItems(bots);
  }, [bots]);

  const presentStatuses = new Set<string>();

  for (const bot of botItems) {
    presentStatuses.add(normalizeStatus(bot.status));
  }

  const statusOptions = [
    {
      label: t((messages) => messages.botsList.allStatuses),
      value: 'all',
    },
    ...BOT_STATUSES.filter((status) => presentStatuses.has(status)).map((status) => ({
      label: getRuntimeStatusPresentation(status, locale).label,
      value: status,
    })),
    ...(presentStatuses.has('unknown')
      ? [
          {
            label: t((messages) => messages.botsList.statusUnknown),
            value: 'unknown',
          },
        ]
      : []),
  ];

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredBots = botItems.filter((bot) => {
    const matchesStatus = statusFilter === 'all' ? true : normalizeStatus(bot.status) === statusFilter;
    const matchesSearch =
      normalizedSearch.length === 0
        ? true
        : [bot.name, bot.provider, bot.model].some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesStatus && matchesSearch;
  });

  if (botItems.length === 0) {
    return (
      <div className="grid gap-6">
        <div className="rounded-[1.45rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/82 px-5 py-4 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-soft)]">
          {quotaSummary}
        </div>
        <EmptyState
          action={(
            <Button asChild>
              <Link href="/bots/new">{t((messages) => messages.shell.createBot)}</Link>
            </Button>
          )}
          description={t((messages) => messages.botsList.noBotsDescription)}
          title={t((messages) => messages.botsList.noBotsTitle)}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-[1.45rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/82 px-5 py-4 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-soft)]">
        {quotaSummary}
      </div>
      <BotOverviewStats bots={botItems} />
      <div className="grid gap-5">
        <BotFilterBar
          onSearchQueryChange={setSearchQuery}
          onStatusFilterChange={(nextValue) => setStatusFilter(nextValue as RuntimeFilterValue)}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          statusOptions={statusOptions}
        />
        {filteredBots.length > 0 ? (
          <BotList
            bots={filteredBots}
            onBotUpdated={(nextBot) => {
              setBotItems((currentBots) => currentBots.map((bot) => (bot.id === nextBot.id ? nextBot : bot)));
            }}
          />
        ) : (
          <EmptyState
            description={t((messages) => messages.botsList.noResultsDescription)}
            title={t((messages) => messages.botsList.noResultsTitle)}
          />
        )}
      </div>
    </div>
  );
}

function normalizeStatus(status: string | null | undefined) {
  const normalized = status?.trim() ?? '';

  return BOT_STATUSES.includes(normalized as (typeof BOT_STATUSES)[number]) ? normalized : 'unknown';
}
